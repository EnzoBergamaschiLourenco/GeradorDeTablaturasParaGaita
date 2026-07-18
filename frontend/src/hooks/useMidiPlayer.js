import { useRef, useState, useEffect } from 'react';
import * as mm from '@magenta/music';

export const midiToNoteName = (midi) => {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(midi / 12) - 1;
  const note = notes[midi % 12];
  return `${note}${octave}`;
};

export function useMidiPlayer() {
  // Suprime aviso do Tone.js (não afeta áudio)
  if (typeof window !== 'undefined' && window.Tone && window.Tone.context?.logger) {
    window.Tone.context.logger.level = 'error';
  }

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

  const sanitizeSequence = (sequence) => {
    if (!sequence.notes || sequence.notes.length === 0) return sequence;
    let filtered = sequence.notes.filter(note => (note.endTime - note.startTime) > 0);
    filtered.sort((a, b) => a.startTime - b.startTime);
    for (let i = 1; i < filtered.length; i++) {
      if (filtered[i].startTime <= filtered[i - 1].startTime) {
        filtered[i].startTime = filtered[i - 1].startTime + 0.001;
      }
    }
    let maxTime = 0;
    filtered.forEach(note => {
      const end = note.endTime;
      if (end > maxTime) maxTime = end;
    });
    return { ...sequence, notes: filtered, totalTime: maxTime };
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
      const volumeMultiplier = currentVolumesRef.current[parteId] ?? 1;
      const instrumentNum = extractInstrumentNumber(parteId);
      seq.notes.forEach(note => {
        combinedNotes.push({
          ...note,
          instrument: instrumentNum,
          // Curva quadrática para variação de volume mais perceptível
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
      tempos: [],
      timeSignatures: firstSeq.timeSignatures || [{ time: 0, numerator: 4, denominator: 4 }],
    };
    delete combinedSequence.qpm;
    delete combinedSequence.quantizationInfo;

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
      setupPlayer();

      playerRef.current.start(combinedSequence, undefined, startTime)
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

  // Recarrega a sequência mantendo o instante atual (com debounce)
  const applyVolumeChangeWithReload = async () => {
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

    setupPlayer();

    if (wasPlaying) {
      playerRef.current.start(newSeq, undefined, currentTime)
        .catch(err => {
          console.error('volume: erro ao retomar', err);
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

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      applyVolumeChangeWithReload();
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