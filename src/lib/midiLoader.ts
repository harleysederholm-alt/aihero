import { Midi } from '@tonejs/midi';
import type { Note } from '../store';

export async function loadMidiChart(url: string): Promise<Note[]> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const midi = new Midi(arrayBuffer);
  
  const notes: Note[] = [];
  let idCounter = 1;

  // GH MIDI files usually have tracks named 'PART GUITAR', 'PART DRUMS', etc.
  // We look for 'PART GUITAR'.
  const guitarTrack = midi.tracks.find(t => 
    t.name.toUpperCase().includes('GUITAR') || 
    t.name.toUpperCase().includes('NOTES')
  );

  if (!guitarTrack) {
    console.warn('No guitar track found in MIDI. Tracks available:', midi.tracks.map(t => t.name));
    return [];
  }

  // Expert: 96-100
  // Hard: 84-88
  // Medium: 72-76
  // Easy: 60-64
  // We'll prioritize Expert, then Hard, etc.
  const difficulties = [
    { name: 'Expert', start: 96 },
    { name: 'Hard', start: 84 },
    { name: 'Medium', start: 72 },
    { name: 'Easy', start: 60 }
  ];

  for (const diff of difficulties) {
    const diffNotes = guitarTrack.notes.filter(n => n.midi >= diff.start && n.midi <= diff.start + 4);
    if (diffNotes.length > 0) {
      console.log(`Loading ${diff.name} difficulty from MIDI`);
      diffNotes.forEach(n => {
        const lane = n.midi - diff.start;
        if (lane < 4) { // We only support 4 lanes for now
          notes.push({
            id: `midi-${idCounter++}`,
            time: n.time,
            lane: lane,
            duration: n.duration > 0.1 ? n.duration : 0
          });
        }
      });
      break; // Found a difficulty with notes, stop here.
    }
  }

  return notes.sort((a, b) => a.time - b.time);
}
