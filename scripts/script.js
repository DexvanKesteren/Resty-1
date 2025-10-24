document.addEventListener('DOMContentLoaded', () => {
  // ==== Elementen ====
  const unlockEl    = document.getElementById('unlock');
  const unlockRange = document.getElementById('unlockRange');
  const faceImg     = document.getElementById('faceImg');
  const bubble      = document.getElementById('bubble');
  const bubbleText  = document.getElementById('bubbleText');
  const answersEl   = document.getElementById('answers');

  // ==== Staat ====
  let isUnlocked = false;
  let mode = 'idle'; // 'idle' | 'sport' | 'rest'
  let motivationIndex = 0;
  let motivationTimer = null;

  // ==== Content ====
  const THRESHOLD = 0.50;
  const motivationLines = [
    'Goed zo, je bent lekker bezig!',
    'Niet opgeven!',
    'Kom op doorgaan!'
  ];
  const restFlow = [
    { type:'q', text:'Ben je al moe?', buttons:[
      { label:'Ja',  cb: () => stepAnswer(() => showTransient('dan ben je goed bezig!', 1500, nextStep)) },
      { label:'Nee', cb: () => stepAnswer(() => showTransient('dan moet je harder trainen', 1500, nextStep)) },
    ]},
    { type:'q', text:'Vergeet je geen water te drinken?', buttons:[
      { label:'Ja',  cb: () => stepAnswer(() => showTransient('ga dan even snel wat drinken', 1800, nextStep)) },
      { label:'Nee', cb: () => stepAnswer(() => showTransient('goed dat je genoeg drinkt', 1500, nextStep)) },
    ]},
    { type:'note', text:'Rust goed uit tussen de oefeningen door, maar niet te lang.', ms:5000 },
    { type:'q', text:'Ben je klaar om verder te gaan?', buttons:[
      { label:'Ja', cb: () => stepAnswer(() => showTransient('zet hem op!', 1500)) }
    ]},
  ];
  let restIndex = 0;

  // ==== UI helpers ====
  function setLine(text) {
    bubbleText.textContent = text;
    answersEl.innerHTML = '';
  }

  function showQuestion(text, buttons) {
    setLine(text);
    buttons.forEach(b => {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = b.label;
      btn.addEventListener('click', b.cb);
      answersEl.appendChild(btn);
    });
  }

  function showTransient(text, ms = 1500, next) {
    setLine(text);
    const t = setTimeout(() => { clearTimeout(t); next && next(); }, ms);
  }

  function stepRest() {
    if (restIndex >= restFlow.length) return;
    const step = restFlow[restIndex];
    if (step.type === 'q') {
      showQuestion(step.text, step.buttons);
    } else { // note
      setLine(step.text);
      const t = setTimeout(() => { clearTimeout(t); restIndex++; stepRest(); }, step.ms || 3000);
    }
  }

  function stepAnswer(afterMessage) {
    answersEl.innerHTML = '';
    afterMessage && afterMessage();
  }

  function nextStep() { restIndex++; stepRest(); }

  function clearMotivation() {
    if (motivationTimer) { clearInterval(motivationTimer); motivationTimer = null; }
  }

  function setMode(next) {
    if (mode === next) return;
    clearMotivation();
    answersEl.innerHTML = '';
    mode = next;

    if (mode === 'sport') {
      motivationIndex = 0;
      setLine(motivationLines[motivationIndex]);
      motivationTimer = setInterval(() => {
        motivationIndex = (motivationIndex + 1) % motivationLines.length;
        setLine(motivationLines[motivationIndex]);
      }, 2500);
    } else if (mode === 'rest') {
      restIndex = 0;
      stepRest();
    } else {
      setLine('Gereed. Beweeg (sport) of rust om Resty te laten reageren.');
    }
  }

  // ==== Slide-to-unlock ====
  function tryUnlock() {
    const v = Number(unlockRange.value);
    if (v >= 95 && !isUnlocked) {
      isUnlocked = true;
      unlockEl.style.display = 'none';
      faceImg.style.display = 'block';
      bubble.classList.remove('hidden');
      setLine('Resty is wakker. Herkenning start...');
      initTM(); // start automatisch
    }
  }
  unlockRange.addEventListener('input', tryUnlock);
  unlockRange.addEventListener('change', tryUnlock);

  // ==== Teachable Machine (Pose) – onzichtbaar ====
  const URL = "./my_model/"; // model.json + metadata.json + weights(.bin)
  let model, webcam;

  async function initTM() {
    try {
      const modelURL = URL + "model.json";
      const metadataURL = URL + "metadata.json";

      model = await tmPose.load(modelURL, metadataURL);

      const size = 224, flip = true;
      webcam = new tmPose.Webcam(size, size, flip);
      await webcam.setup();
      await webcam.play();

      setLine('Herkenning actief. Beweeg (sport) of rust en kijk wat Resty zegt!');
    } catch (err) {
      console.error(err);
      setLine('Kon de herkenning niet starten. Controleer je modelmap (./my_model/).');
    }
  }

  async function predict() {
    // Alleen draaien als model/webcam actief zijn
    if (!model || !webcam) return;

    const { posenetOutput } = await model.estimatePose(webcam.canvas);
    const prediction = await model.predict(posenetOutput);

    let pSport = 0, pRest = 0;
    prediction.forEach(p => {
      const name = (p.className || '').toLowerCase();
      if (name.includes('sport')) pSport = p.probability; // dekt 'sporten'
      if (name === 'rust')       pRest  = p.probability;
    });

    if (pSport > THRESHOLD && pSport >= pRest) {
      setMode('sport');
    } else if (pRest > THRESHOLD && pRest > pSport) {
      setMode('rest');
    }
  }

  // Eén lichte loop die alleen werkt als model/webcam bestaan
  (function loop() {
    requestAnimationFrame(loop);
    if (webcam) webcam.update();
    predict();
  })();
});
