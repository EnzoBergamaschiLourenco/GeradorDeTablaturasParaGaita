import { useRef, useState, useEffect } from 'react';
import * as mm from '@magenta/music';

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
  const debounceTimerRef = useRef(null);
  const baseTempoRef = useRef(120);
  
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [tempoAtual, setTempoAtual] = useState(0);
  const [volumes, setVolumesState] = useState({});

  const extractInstrumentNumber = (id) => {
    const numStr = String(id).replace(/\D/g, '');
    return numStr ? parseInt(numStr, 10) : 0;
  };

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
      const url = `http://127.0.0.1:8000/midi/play/${midiPath}?partes=${parteId}&_t=${Date.now()}`;
      const seq = await mm.urlToNoteSequence(url);
      if (!seq || !seq.notes || seq.notes.length === 0) continue;
      if (!firstSeq || (firstSeq.tempos?.length === 0 && seq.tempos?.length > 0)) {
        firstSeq = seq;
      }
      const volumeMultiplier = currentVolumesRef.current[parteId] ?? 1;
      const instrumentNum = extractInstrumentNumber(parteId);
      seq.notes.forEach(note => {
        combinedNotes.push({
          ...note,
          instrument: instrumentNum,
          velocity: Math.min(1, Math.max(0, note.velocity * volumeMultiplier * volumeMultiplier)),
        });
      });
      if (seq.totalTime > maxTime) maxTime = seq.totalTime;
    }

    if (!firstSeq || combinedNotes.length === 0) {
      throw new Error('Nenhuma parte possui notas.');
    }

    let combinedSequence = {
      ...firstSeq,
      notes: combinedNotes,
      totalTime: maxTime,
      tempos: (firstSeq.tempos && firstSeq.tempos.length > 0) ? firstSeq.tempos : [{ time: 0, qpm: 120 }],
      timeSignatures: firstSeq.timeSignatures || [{ time: 0, numerator: 4, denominator: 4 }],
    };

    combinedSequence = sanitizeSequence(combinedSequence);
    totalDurationRef.current = combinedSequence.totalTime;
    currentPartesIdsRef.current = partesIds;
    currentMidiPathRef.current = midiPath;
    sequenceRef.current = combinedSequence;
    setDuration(combinedSequence.totalTime);
    baseTempoRef.current = combinedSequence.tempos?.[0]?.qpm || 120;
    return combinedSequence;
  };

  // ────────────────────────────
  //  CRIAÇÃO DO PLAYER (CORRIGIDA)
  // ────────────────────────────
  const setupPlayer = () => {
    getAudioContext();
    if (playerRef.current) {
      try { playerRef.current.stop(); } catch {}
    }
    
    // O SEGREDO ESTÁ AQUI: O callback 'run' fornece o tempo perfeitamente sincronizado.
    // 'false' significa que o Magenta não vai tentar gerenciar o contexto de áudio sozinho.
    playerRef.current = new mm.Player(false, {
      run: (note) => {
        // Toda vez que uma nota toca, o tempo atual é atualizado.
        // Como o player muda a velocidade sozinho, este startTime sempre bate com a nota visual.
        if (note && typeof note.startTime === 'number') {
          setTempoAtual(note.startTime);
          if (totalDurationRef.current > 0) {
            setProgress((note.startTime / totalDurationRef.current) * 100);
          }
        }
      },
      stop: () => {
        setIsPlaying(false);
        isPlayingRef.current = false;
      }
    });

    if (playerRef.current.synth) {
      playerRef.current.synth.maxPolyphony = 512;
    }
    const baseTempo = sequenceRef.current?.tempos?.[0]?.qpm || 120;
    baseTempoRef.current = baseTempo;
    playerRef.current.setTempo(baseTempo * playbackSpeed);
  };

  const stopAll = () => {
    if (playerRef.current) {
      try { playerRef.current.stop(); } catch {}
      playerRef.current = null;
    }
    isPlayingRef.current = false;
    playingIdRef.current = null;
    setIsPlaying(false);
    setPlayingId(null);
    setProgress(0);
    setTempoAtual(0);
    pausedTimeRef.current = 0;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  };

  const pauseAll = () => {
    if (playerRef.current) {
      try {
        // Salvamos o último tempo atualizado pelo 'run'
        pausedTimeRef.current = tempoAtual;
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
  };

  const startAll = async (partesIds, midiPath, startTime = 0) => {
    try {
      stopAll();

      const combinedSequence = await loadCombinedSequence(partesIds, midiPath);
      setupPlayer();

      playerRef.current.start(combinedSequence, undefined, startTime)
        .catch(err => {
          console.error('Erro no player.start:', err);
          stopAll();
        });

      isPlayingRef.current = true;
      playingIdRef.current = 'ALL';
      setIsPlaying(true);
      setPlayingId('ALL');
      pausedTimeRef.current = startTime;
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
  };

  const recreatePlayerAtTime = async (targetTime, shouldPlay) => {
    if (currentPartesIdsRef.current.length === 0 || !currentMidiPathRef.current) return;
    if (playerRef.current) {
      try { playerRef.current.stop(); } catch {}
      playerRef.current = null;
    }
    const newSeq = await loadCombinedSequence(
      currentPartesIdsRef.current,
      currentMidiPathRef.current
    );
    setupPlayer();
    if (shouldPlay) {
      playerRef.current.start(newSeq, undefined, targetTime).catch(err => console.error(err));
      isPlayingRef.current = true;
      playingIdRef.current = 'ALL';
      setIsPlaying(true);
      setPlayingId('ALL');
    } else {
      pausedTimeRef.current = targetTime;
      sequenceRef.current = newSeq;
    }
    setTempoAtual(targetTime);
    setProgress((targetTime / (totalDurationRef.current || 1)) * 100);
  };

  const applyVolumeChangeWithReload = async () => {
    if (currentPartesIdsRef.current.length === 0 || !currentMidiPathRef.current) return;
    const wasPlaying = isPlayingRef.current;
    const currentTime = wasPlaying ? tempoAtual : pausedTimeRef.current;
    await recreatePlayerAtTime(currentTime, wasPlaying);
  };

  const setVolume = (parteId, vol) => {
    const normalized = Math.min(1, Math.max(0, vol));
    setVolumesState(prev => ({ ...prev, [parteId]: normalized }));
    currentVolumesRef.current[parteId] = normalized;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      applyVolumeChangeWithReload();
    }, 500);
  };

  const changeSpeed = (newSpeed) => {
    setPlaybackSpeed(newSpeed);
    if (playerRef.current) {
      const newTempo = baseTempoRef.current * newSpeed;
      playerRef.current.setTempo(newTempo);
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