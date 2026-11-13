// Pitch, vocal resonances, breath and duration give each fighter a distinct voice.
export const VOICES = {
  jin: { pitch: 155, formants: [760, 1250, 2550], duration: .8, rasp: .08 },
  sparring: { pitch: 119, formants: [620, 1100, 2200], duration: .65, rasp: .17 },
  brakka: { pitch: 78, formants: [480, 900, 1850], duration: .95, rasp: .25 },
  selune: { pitch: 245, formants: [880, 1500, 2900], duration: .9, rasp: .03 },
  vorr: { pitch: 103, formants: [510, 1400, 2350], duration: .75, rasp: .19 },
  zeta: { pitch: 132, formants: [660, 1700, 3100], duration: .85, rasp: .02, robot: true },
  draal: { pitch: 62, formants: [390, 820, 1650], duration: 1.15, rasp: .3 },
  redhair: { pitch: 176, formants: [800, 1320, 2600], duration: .85, rasp: .14 },
  green: { pitch: 94, formants: [430, 1150, 2100], duration: .95, rasp: .11 },
  redgi: { pitch: 145, formants: [710, 1190, 2450], duration: .7, rasp: .12 },
  gold: { pitch: 275, formants: [930, 1600, 3050], duration: 1, rasp: .04 },
  mage: { pitch: 198, formants: [650, 1800, 3200], duration: 1.1, rasp: .09 },
};

/** A voiced glottal source shaped through vowel resonances: a wordless defeat yell. */
export function defeatVoice(audio, id) {
  const c = audio.ctx, p = VOICES[id] || VOICES.jin, t = c.currentTime, end = t + p.duration;
  const source = c.createOscillator(), envelope = c.createGain();
  source.type = p.robot ? 'square' : 'sawtooth';
  source.frequency.setValueAtTime(p.pitch * 1.3, t);
  source.frequency.exponentialRampToValueAtTime(p.pitch * 1.65, t + .1);
  source.frequency.exponentialRampToValueAtTime(p.pitch * .52, end);
  envelope.gain.setValueAtTime(.001, t);
  envelope.gain.exponentialRampToValueAtTime(.32, t + .045);
  envelope.gain.setValueAtTime(.24, t + p.duration * .4);
  envelope.gain.exponentialRampToValueAtTime(.001, end);
  envelope.connect(audio.sfxBus);
  p.formants.forEach((freq, i) => {
    const filter = c.createBiquadFilter(), gain = c.createGain();
    filter.type = 'bandpass'; filter.Q.value = 5 + i * 2;
    filter.frequency.setValueAtTime(freq, t);
    filter.frequency.exponentialRampToValueAtTime(freq * .65, end);
    gain.gain.value = [1, .55, .24][i];
    source.connect(filter).connect(gain).connect(envelope);
  });
  const vibrato = c.createOscillator(), depth = c.createGain();
  vibrato.frequency.value = p.robot ? 37 : 6.5; depth.gain.value = p.robot ? 28 : p.pitch * .035;
  vibrato.connect(depth).connect(source.frequency);vibrato.start(t);vibrato.stop(end);
  source.start(t);source.stop(end + .02);
  audio.noise({dur:p.duration,vol:p.rasp,freq:1400});
  if(p.robot) [0,.13,.29,.48].forEach(delay=>audio.tone({type:'square',freq:900,to:110,dur:.1,vol:.08,delay}));
}
