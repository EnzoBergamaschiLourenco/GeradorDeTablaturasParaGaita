import { useRef, useState, useEffect } from 'react';
import * as mm from '@magenta/music';
import { urlTocarParte } from '../services/gaitaApiService';

export const midiToNoteName = (midi) => {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(midi / 12) - 1;
  const note = notes[midi % 12];
  return `${note}${octave}`;
};

export function useMidiPlayer() {
  // Suprime aviso do Tone.js
  if (typeof window !== 'undefined' && window.Tone && window.Tone.context?.logger) {
    window.Tone.context.logger.level = 'error';
  }

  const audioCtxRef = useRef(null);
  const playerRef = useRef(null);
  const isPlayingRef = useRef(false);
  const playingIdRef = useRef(null);
  const totalDurationRef = useRef(0);
  const pausedTimeRef = useRef(0);
  const currentVolumesRef = useRef({});
  const currentPartesIdsRef = useRef([]);
  const currentMidiPathRef = useRef('');
  const sequenceRef = useRef(null);
  const partesNotasRef = useRef({});
  const soloParteIdRef = useRef(null);
  const volumesAntesSoloRef = useRef(null);
  const baseTempoRef = useRef(120);
  const animationFrameRef = useRef(null);
  const playbackClockStartRef = useRef(0);
  const playbackClockSequenceStartRef = useRef(0);

  // NOVA REF: Armazena a velocidade para o loop de animação ler o valor atualizado
  const playbackSpeedRef = useRef(1);

  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [tempoAtual, setTempoAtual] = useState(0);
  const [volumes, setVolumesState] = useState({});
  const [soloParteId, setSoloParteId] = useState(null);

  const extractInstrumentNumber = (id) => {
    const numStr = String(id).replace(/\D/g, '');
    return numStr ? parseInt(numStr, 10) : 0;
  };

  // Curva perceptual (quadrática) para o volume, igual à usada originalmente.
  const calcularVelocidadeComVolume = (baseVelocity, volume) =>
    Math.min(127, Math.max(0, Math.floor(baseVelocity * volume * volume)));

  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const sanitizeSequence = (seq) => {
    if (!seq.notes) return seq;
    let sortedNotes = [...seq.notes].sort((a, b) => a.startTime - b.startTime);
    for (let i = 1; i < sortedNotes.length; i++) {
      if (sortedNotes[i].startTime <= sortedNotes[i - 1].startTime) {
        sortedNotes[i].startTime = sortedNotes[i - 1].startTime + 0.001;
        sortedNotes[i].endTime = Math.max(sortedNotes[i].endTime, sortedNotes[i].startTime + 0.001);
      }
    }
    const cleanNotes = sortedNotes.map(n => ({
      ...n,
      instrument: n.isDrum ? 0 : Math.min(127, Math.max(0, n.instrument || 0)),
      velocity: Math.min(127, Math.max(0, Math.floor(n.velocity)))
    }));
    return { ...seq, notes: cleanNotes };
  };

  const loadCombinedSequence = async (partesIds, midiPath) => {
    let combinedNotes = [];
    let maxTime = 0;
    let firstSeq = null;

    for (const parteId of partesIds) {
      const url = urlTocarParte(midiPath, parteId);
      const seq = await mm.urlToNoteSequence(url);

      if (!seq || !seq.notes || seq.notes.length === 0) continue;
      if (!firstSeq || (firstSeq.tempos?.length === 0 && seq.tempos?.length > 0)) {
        firstSeq = seq;
      }

      const volumeMultiplier = currentVolumesRef.current[parteId] ?? 1;
      const instrumentNum = extractInstrumentNumber(parteId);

      seq.notes.forEach(note => {
        const baseVelocity = Math.min(127, Math.max(0, Math.floor(note.velocity)));
        combinedNotes.push({
          ...note,
          instrument: instrumentNum,
          parteId,
          baseVelocity,
          velocity: calcularVelocidadeComVolume(baseVelocity, volumeMultiplier),
        });
      });
      if (seq.totalTime > maxTime) maxTime = seq.totalTime;
    }

    if (!firstSeq || combinedNotes.length === 0) {
      throw new Error('Nenhuma parte possui notas.');
    }

    let combinedSequence = {
      ...firstSeq,
      notes: [
        ...combinedNotes,
      ],
      totalTime: maxTime,
      tempos: (firstSeq.tempos && firstSeq.tempos.length > 0)
        ? firstSeq.tempos
        : [{ time: 0, qpm: 120 }],
      timeSignatures: firstSeq.timeSignatures || [{ time: 0, numerator: 4, denominator: 4 }],
    };

    combinedNotes.sort((a, b) => {
      if (a.startTime !== b.startTime)
        return a.startTime - b.startTime;

      return a.pitch - b.pitch;
    });

    combinedSequence = sanitizeSequence(combinedSequence);

    const notasPorParte = {};
    combinedSequence.notes.forEach(nota => {
      if (!notasPorParte[nota.parteId]) notasPorParte[nota.parteId] = [];
      notasPorParte[nota.parteId].push(nota);
    });
    partesNotasRef.current = notasPorParte;

    totalDurationRef.current = combinedSequence.totalTime;
    currentPartesIdsRef.current = partesIds;
    currentMidiPathRef.current = midiPath;
    sequenceRef.current = combinedSequence;
    setDuration(combinedSequence.totalTime);
    baseTempoRef.current = combinedSequence.tempos?.[0]?.qpm || 120;
    return combinedSequence;
  };

  const stopPlaybackClock = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const updatePlaybackClock = () => {
    if (!isPlayingRef.current || !audioCtxRef.current) {
      return;
    }

    const elapsedAudioTime =
      audioCtxRef.current.currentTime -
      playbackClockStartRef.current;

    // AQUI: Usando a ref para garantir a leitura do valor mais recente de velocidade
    const currentTime =
      playbackClockSequenceStartRef.current +
      (elapsedAudioTime * playbackSpeedRef.current);

    const clampedTime = Math.min(
      currentTime,
      totalDurationRef.current
    );

    setTempoAtual(clampedTime);

    if (totalDurationRef.current > 0) {
      setProgress(
        Math.min(
          100,
          Math.max(
            0,
            (clampedTime / totalDurationRef.current) * 100
          )
        )
      );
    }

    animationFrameRef.current = requestAnimationFrame(updatePlaybackClock);
  };

  const startPlaybackClock = (sequenceStartTime = 0) => {
    stopPlaybackClock();
    playbackClockStartRef.current = audioCtxRef.current.currentTime;
    playbackClockSequenceStartRef.current = sequenceStartTime;
    animationFrameRef.current = requestAnimationFrame(updatePlaybackClock);
  };

  const setupPlayer = () => {
    getAudioContext();
    if (playerRef.current) {
      try { playerRef.current.stop(); } catch { }
    }

    playerRef.current = new mm.Player(false, {
      run: (note) => {
        // O requestAnimationFrame é o único responsável pelo estado tempoAtual.
      },
      stop: () => {
        setIsPlaying(false);
        isPlayingRef.current = false;
      }
    });

    const baseTempo = sequenceRef.current?.tempos?.[0]?.qpm || 120;
    baseTempoRef.current = baseTempo;
    playerRef.current.setTempo(baseTempo * playbackSpeedRef.current);
  };

  const stopAll = () => {
    stopPlaybackClock();
    if (playerRef.current) {
      try { playerRef.current.stop(); } catch { }
      playerRef.current = null;
    }
    isPlayingRef.current = false;
    playingIdRef.current = null;
    setIsPlaying(false);
    setPlayingId(null);
    setProgress(0);
    setTempoAtual(0);
    pausedTimeRef.current = 0;
  };

  const pauseAll = () => {
    stopPlaybackClock();
    changeSpeed(parseFloat(1));
    if (playerRef.current) {
      try {
        // Calcula o tempo REAL da sequência, usando as mesmas refs do relógio
        let currentTime = 0;
        if (audioCtxRef.current && playbackClockStartRef.current) {
          const elapsedAudio =
            audioCtxRef.current.currentTime - playbackClockStartRef.current;
          currentTime =
            playbackClockSequenceStartRef.current +
            elapsedAudio * playbackSpeedRef.current;
        } else {
          // fallback seguro (nunca deveria ser usado, mas evita 0)
          currentTime = tempoAtual;
        }
        pausedTimeRef.current = currentTime;
        playerRef.current.pause();

      } catch (e) {
        console.error("Erro ao pausar:", e);
        pausedTimeRef.current = tempoAtual;
      }
    }
    isPlayingRef.current = false;
    setIsPlaying(false);
  };

  const resumeAll = () => {
    const seekTime = pausedTimeRef.current;
    if (!playerRef.current) {
      startAll(currentPartesIdsRef.current, currentMidiPathRef.current, seekTime);
      return;
    }
    try {
      playerRef.current.seekTo(seekTime);
      playerRef.current.resume();

      // Força a velocidade logo após retomar do pause
      playerRef.current.setTempo(baseTempoRef.current * playbackSpeedRef.current);

    } catch (e) {
      console.warn('Falha ao retomar, recriando player');
      playerRef.current.stop();
      playerRef.current = null;
      startAll(currentPartesIdsRef.current, currentMidiPathRef.current, seekTime);
      return;
    }
    isPlayingRef.current = true;
    playingIdRef.current = 'ALL';
    setIsPlaying(true);
    setPlayingId('ALL');
    startPlaybackClock(seekTime);
  };

  const startAll = async (partesIds, midiPath, startTime = 0) => {
    try {
      stopAll();

      const combinedSequence = await loadCombinedSequence(partesIds, midiPath);
      setupPlayer();

      // Inicia a música com parâmetro 'undefined' para qpm e força via setTempo em seguida
      playerRef.current.polySynth.maxPolyphony = 1000
      playerRef.current.start(combinedSequence, undefined, startTime)
        .catch(err => {
          console.error('Erro no player.start:', err);
          stopAll();
        });

      playerRef.current.setTempo(baseTempoRef.current * playbackSpeedRef.current);

      isPlayingRef.current = true;
      playingIdRef.current = 'ALL';
      setIsPlaying(true);
      setPlayingId('ALL');
      pausedTimeRef.current = startTime;
      startPlaybackClock(startTime);
    } catch (err) {
      console.error('Erro ao iniciar reprodução:', err);
      stopAll();
    }
  };

  const seek = (percent) => {
    if (!totalDurationRef.current) return;
    const targetTime = (percent / 100) * totalDurationRef.current;

    if (isPlayingRef.current && playerRef.current) {
      try {
        playerRef.current.seekTo(targetTime);
        playerRef.current.setTempo(baseTempoRef.current * playbackSpeedRef.current);
      } catch (e) {
        console.warn('seekTo falhou, recriando player');
        recreatePlayerAtTime(targetTime, true);
        return;
      }
    } else {
      pausedTimeRef.current = targetTime;
    }

    setTempoAtual(targetTime);
    setProgress(percent);

    if (isPlayingRef.current) {
      startPlaybackClock(targetTime);
    }
  };

  const recreatePlayerAtTime = async (targetTime, shouldPlay) => {
    if (currentPartesIdsRef.current.length === 0 || !currentMidiPathRef.current) return;
    if (playerRef.current) {
      try { playerRef.current.stop(); } catch { }
      playerRef.current = null;
    }
    const newSeq = await loadCombinedSequence(
      currentPartesIdsRef.current,
      currentMidiPathRef.current
    );

    setupPlayer();
    if (shouldPlay) {
      playerRef.current.start(newSeq, undefined, targetTime).catch(err => console.error(err));
      playerRef.current.setTempo(baseTempoRef.current * playbackSpeedRef.current);

      isPlayingRef.current = true;
      playingIdRef.current = 'ALL';
      setIsPlaying(true);
      setPlayingId('ALL');
      startPlaybackClock(targetTime);
    } else {
      pausedTimeRef.current = targetTime;
      sequenceRef.current = newSeq;
    }
    setTempoAtual(targetTime);
    setProgress((targetTime / (totalDurationRef.current || 1)) * 100);
  };

  // Aplica o volume imediatamente: atualiza o estado/refs e, se a sequência já
  // estiver carregada, ajusta a velocidade das notas dessa parte "ao vivo" (o
  // Tone.Part lê o valor de `velocity` no momento em que cada nota dispara, então
  // isso funciona tanto tocando quanto pausado, sem recriar o player).
  const aplicarVolumeInterno = (parteId, vol) => {
    const normalized = Math.min(1, Math.max(0, vol));
    currentVolumesRef.current[parteId] = normalized;
    setVolumesState(prev => (prev[parteId] === normalized ? prev : { ...prev, [parteId]: normalized }));

    const notas = partesNotasRef.current[parteId];
    if (notas) {
      notas.forEach(nota => {
        nota.velocity = calcularVelocidadeComVolume(nota.baseVelocity, normalized);
      });
    }
  };

  const setVolume = (parteId, vol) => {
    // Ajustar manualmente uma parte encerra o modo solo (o pressuposto de
    // "só uma parte com som" deixa de valer assim que o usuário mexe no fader).
    if (soloParteIdRef.current !== null) {
      soloParteIdRef.current = null;
      volumesAntesSoloRef.current = null;
      setSoloParteId(null);
    }
    aplicarVolumeInterno(parteId, vol);
  };

  const alternarSolo = (parteId, todosParteIds) => {
    if (soloParteIdRef.current === parteId) {
      // Já está em solo nesta parte: desfaz e restaura os volumes anteriores.
      const snapshot = volumesAntesSoloRef.current || {};
      todosParteIds.forEach(id => aplicarVolumeInterno(id, snapshot[id] ?? 1));
      volumesAntesSoloRef.current = null;
      soloParteIdRef.current = null;
      setSoloParteId(null);
      return;
    }

    if (soloParteIdRef.current === null) {
      const snapshot = {};
      todosParteIds.forEach(id => { snapshot[id] = currentVolumesRef.current[id] ?? 1; });
      volumesAntesSoloRef.current = snapshot;
    }

    todosParteIds.forEach(id => {
      const volumeAlvo = id === parteId ? (volumesAntesSoloRef.current[id] ?? 1) : 0;
      aplicarVolumeInterno(id, volumeAlvo);
    });
    soloParteIdRef.current = parteId;
    setSoloParteId(parteId);
  };

  const resetarVolumes = (todosParteIds) => {
    soloParteIdRef.current = null;
    volumesAntesSoloRef.current = null;
    setSoloParteId(null);
    todosParteIds.forEach(id => aplicarVolumeInterno(id, 1));
  };

  const changeSpeed = (newSpeed) => {
    const oldSpeed = playbackSpeedRef.current;

    playbackSpeedRef.current = newSpeed;
    setPlaybackSpeed(newSpeed);

    if (playerRef.current) {
      const newTempo = baseTempoRef.current * newSpeed;
      playerRef.current.setTempo(newTempo);

      // Se estiver tocando, reancora o relógio de progresso para evitar saltos
      if (isPlayingRef.current && audioCtxRef.current) {
        const elapsedAudioTime = audioCtxRef.current.currentTime - playbackClockStartRef.current;
        const currentSeqTime = playbackClockSequenceStartRef.current + (elapsedAudioTime * oldSpeed);

        playbackClockStartRef.current = audioCtxRef.current.currentTime;
        playbackClockSequenceStartRef.current = currentSeqTime;
      }
      // 🔧 CORREÇÃO: se estiver pausado, realinha a posição interna do player
      else if (!isPlayingRef.current) {
        // Força a posição da sequência para o tempo exato de pausa
        const safeTime = pausedTimeRef.current ?? 0;
        playerRef.current.seekTo(safeTime);
        // seekTo não altera o estado de pausa, mas por segurança:
        playerRef.current.pause();
      }
    }
  };

  const togglePlayAll = async (partesIds, midiPath, volumesObj) => {
    if (volumesObj) {
      Object.keys(volumesObj).forEach(id => {
        currentVolumesRef.current[id] = volumesObj[id];
      });
    }

    if (!midiPath) return;
    if (!Array.isArray(partesIds) || partesIds.length === 0) return;

    if (isPlayingRef.current) {
      pauseAll();
      return;
    }
    if (playerRef.current) {
      resumeAll();
      return;
    }
    await startAll(partesIds, midiPath, 0);
  };

  useEffect(() => {
    return () => {
      stopAll();
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  return {
    togglePlayAll,
    stop: stopAll,
    seek,
    setVolumes: setVolume,
    alterarVolume: setVolume,
    alternarSolo,
    resetarVolumes,
    soloParteId,
    progress,
    duration,
    isPlaying,
    playingId,
    tempoAtual,
    volumes,
    changeSpeed,
    playbackSpeed,
  };
}