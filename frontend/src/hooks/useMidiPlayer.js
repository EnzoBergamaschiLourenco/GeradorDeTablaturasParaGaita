import { useRef, useState, useEffect } from 'react';
import * as mm from '@magenta/music';

export const midiToNoteName = (midi) => {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(midi / 12) - 1;
  const note = notes[midi % 12];
  return `${note}${octave}`;
};

export function useMidiPlayer() {
  const VOLUME_BOOST = 2; // boost master moderado (2x)

  const audioCtxRef = useRef(null);
  const playerRef = useRef(null);
  const isPlayingRef = useRef(false);
  const playingIdRef = useRef(null);
  const totalDurationRef = useRef(0);
  const startTimeRef = useRef(0);
  const pausedTimeRef = useRef(0);
  const animationRef = useRef(null);
  const currentVolumesRef = useRef({});
  const currentPartesIdsRef = useRef([]);
  const currentMidiPathRef = useRef('');
  const sequenceRef = useRef(null);
  const debounceTimerRef = useRef(null);

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

  /**
   * Sanitiza a sequência: remove notas inválidas e ajusta tempos duplicados.
   * Corrigido para calcular a duração real (endTime - startTime).
   */
  const sanitizeSequence = (sequence) => {
    if (!sequence.notes || sequence.notes.length === 0) return sequence;
    
    // 1. Remove notas com duração <= 0 (usando endTime - startTime)
    let filtered = sequence.notes.filter(note => (note.endTime - note.startTime) > 0);
    
    // 2. Ordena por startTime
    filtered.sort((a, b) => a.startTime - b.startTime);
    
    // 3. Garante tempos estritamente crescentes (epsilon de 0.001s)
    for (let i = 1; i < filtered.length; i++) {
      if (filtered[i].startTime <= filtered[i-1].startTime) {
        filtered[i].startTime = filtered[i-1].startTime + 0.001;
      }
    }
    
    // 4. Recalcula totalTime
    let maxTime = 0;
    filtered.forEach(note => {
      const end = note.endTime; // endTime já é confiável
      if (end > maxTime) maxTime = end;
    });
    
    return {
      ...sequence,
      notes: filtered,
      totalTime: maxTime
    };
  };

  const loadCombinedSequence = async (partesIds, midiPath) => {
    let combinedNotes = [];
    let maxTime = 0;
    let firstSeq = null;

    for (const parteId of partesIds) {
      const url = `http://127.0.0.1:8000/midi/play/${midiPath}?partes=${parteId}&_t=${Date.now()}`;
      const seq = await mm.urlToNoteSequence(url);
      if (!seq || !seq.notes || seq.notes.length === 0) continue;
      if (!firstSeq) firstSeq = seq;
      const instrumentNum = extractInstrumentNumber(parteId);
      seq.notes.forEach(note => {
        combinedNotes.push({
          ...note,
          instrument: instrumentNum
        });
      });
      if (seq.totalTime > maxTime) maxTime = seq.totalTime;
    }

    if (!firstSeq || combinedNotes.length === 0) {
      // Retorna sequência vazia – será tratada silenciosamente em startAll
      return { notes: [], totalTime: 0, tempos: [], timeSignatures: [] };
    }

    let combinedSequence = {
      ...firstSeq,
      notes: combinedNotes,
      totalTime: maxTime,
      tempos: [],
      timeSignatures: firstSeq.timeSignatures || [{ time: 0, numerator: 4, denominator: 4 }]
    };
    delete combinedSequence.qpm;
    delete combinedSequence.quantizationInfo;

    // Aplica sanitização (agora com cálculo correto de duração)
    combinedSequence = sanitizeSequence(combinedSequence);

    totalDurationRef.current = combinedSequence.totalTime;
    currentPartesIdsRef.current = partesIds;
    currentMidiPathRef.current = midiPath;
    sequenceRef.current = combinedSequence;
    setDuration(combinedSequence.totalTime);
    return combinedSequence;
  };

  const setupPlayer = () => {
    const ctx = getAudioContext();
    if (playerRef.current) {
      try { playerRef.current.stop(); } catch {}
    }
    playerRef.current = new mm.Player(ctx);
    if (playerRef.current.synth) {
      playerRef.current.synth.maxPolyphony = 512;
    }
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
    startTimeRef.current = 0;
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  };

  const pauseAll = () => {
    if (playerRef.current) {
      try { playerRef.current.pause(); } catch {}
    }
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    pausedTimeRef.current = tempoAtual;
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
    startTimeRef.current = performance.now() - seekTime * 1000;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    updateProgressLoop();
  };

  const startAll = async (partesIds, midiPath, startTime = 0) => {
    try {
      stopAll();
      getAudioContext();

      const combinedSequence = await loadCombinedSequence(partesIds, midiPath);

      // Se nenhuma nota válida, sai silenciosamente
      if (combinedSequence.totalTime <= 0) {
        return;
      }

      setupPlayer();

      playerRef.current.start(combinedSequence, undefined, startTime)
        .then(() => applyAllGains())
        .catch(err => {
          console.error('Erro no player.start:', err);
          setIsPlaying(false);
          setPlayingId(null);
          isPlayingRef.current = false;
          playingIdRef.current = null;
        });

      isPlayingRef.current = true;
      playingIdRef.current = 'ALL';
      setIsPlaying(true);
      setPlayingId('ALL');
      startTimeRef.current = performance.now() - startTime * 1000;
      pausedTimeRef.current = startTime;
      setTempoAtual(startTime);
      setProgress((startTime / (totalDurationRef.current || 1)) * 100);

      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      updateProgressLoop();
    } catch (err) {
      console.error('Erro ao iniciar reprodução:', err);
      setIsPlaying(false);
      setPlayingId(null);
      isPlayingRef.current = false;
      playingIdRef.current = null;
    }
  };

  const updateProgressLoop = () => {
    if (!isPlayingRef.current) return;
    const elapsed = (performance.now() - startTimeRef.current) / 1000;
    const current = Math.min(elapsed, totalDurationRef.current || 1);
    setTempoAtual(current);
    setProgress((current / (totalDurationRef.current || 1)) * 100);
    if (current >= (totalDurationRef.current || 1)) {
      isPlayingRef.current = false;
      playingIdRef.current = null;
      setIsPlaying(false);
      setPlayingId(null);
      setProgress(100);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }
    animationRef.current = requestAnimationFrame(updateProgressLoop);
  };

  const seek = (percent) => {
    if (!totalDurationRef.current) return;
    const targetTime = (percent / 100) * totalDurationRef.current;

    if (isPlayingRef.current && playerRef.current) {
      try {
        playerRef.current.seekTo(targetTime);
        startTimeRef.current = performance.now() - targetTime * 1000;
      } catch (e) {}
    }

    pausedTimeRef.current = targetTime;
    setTempoAtual(targetTime);
    setProgress(percent);
  };

  const applyAllGains = () => {
    if (!playerRef.current) return;
    Object.entries(currentVolumesRef.current).forEach(([parteId, vol]) => {
      const instrumentNum = extractInstrumentNumber(parteId);
      try {
        playerRef.current.setGain(vol * VOLUME_BOOST, instrumentNum);
      } catch (e) {}
    });
  };

  const applyImmediateGain = (parteId, normalized) => {
    if (!playerRef.current) return;
    const instrumentNum = extractInstrumentNumber(parteId);
    try {
      playerRef.current.setGain(normalized * VOLUME_BOOST, instrumentNum);
    } catch (e) {}
  };

  const applyVolumeChangeWithReload = async (parteId, normalized) => {
    if (currentPartesIdsRef.current.length === 0 || !currentMidiPathRef.current) return;
    const wasPlaying = isPlayingRef.current;
    const currentTime = wasPlaying ? tempoAtual : pausedTimeRef.current;

    if (playerRef.current) {
      try { playerRef.current.stop(); } catch {}
      playerRef.current = null;
    }

    const newSeq = await loadCombinedSequence(
      currentPartesIdsRef.current,
      currentMidiPathRef.current
    );

    if (newSeq.totalTime <= 0) {
      stopAll();
      return;
    }

    const ctx = getAudioContext();
    const newPlayer = new mm.Player(ctx);
    playerRef.current = newPlayer;
    if (newPlayer.synth) newPlayer.synth.maxPolyphony = 512;

    if (wasPlaying) {
      newPlayer.start(newSeq, undefined, currentTime)
        .then(() => applyAllGains())
        .catch(err => {
          isPlayingRef.current = false;
          setIsPlaying(false);
          playerRef.current = null;
        });
      startTimeRef.current = performance.now() - currentTime * 1000;
      pausedTimeRef.current = currentTime;
    } else {
      pausedTimeRef.current = currentTime;
      sequenceRef.current = newSeq;
      setTempoAtual(currentTime);
      setProgress((currentTime / (totalDurationRef.current || 1)) * 100);
    }
  };

  const setVolume = (parteId, vol) => {
    const normalized = Math.min(1, Math.max(0, vol));
    setVolumesState(prev => ({ ...prev, [parteId]: normalized }));
    currentVolumesRef.current[parteId] = normalized;
    applyImmediateGain(parteId, normalized);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      applyVolumeChangeWithReload(parteId, normalized);
    }, 500);
  };

  const togglePlayAll = async (partesIds, midiPath, volumesObj) => {
    Object.keys(volumesObj || {}).forEach(id => {
      currentVolumesRef.current[id] = volumesObj[id] ?? 1;
    });

    if (!midiPath) return;
    if (!Array.isArray(partesIds) || partesIds.length === 0) return;

    if (playingIdRef.current === 'ALL' && isPlayingRef.current) {
      pauseAll();
      return;
    }
    if (playingIdRef.current === 'ALL' && !isPlayingRef.current && playerRef.current) {
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
  };
}