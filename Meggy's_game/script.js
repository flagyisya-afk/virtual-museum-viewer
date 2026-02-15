(function(){
  const WORLD = document.getElementById('world');
  const COUNTER = document.getElementById('counter');
  const OVERLAY = document.getElementById('overlay');
  const WINMSG = document.getElementById('win-msg');
  const REPLAY = document.getElementById('replay');
  const CONF = document.getElementById('confetti');
  const LOADER = document.getElementById('loader');
  const PLAY = document.getElementById('playBtn');

  const TOTAL = 8;
  const messages = [
    "You make my heart smile.",
    "Are you sleepy? Because you’ve been running through my mind all day.",
    "You're my favorite adventure.",
    "I love how you laugh.",
    "You're beautiful inside and out.",
    "Thank you for being you.",
    "Let's make more memories.",
    "I thought of you when I made this. 💖 And I think it would be really funny to watch you try and read all this text. So here is the entire alphabet, upper and lowercase. A B C D E F G H I J K L M N O P Q R S T U V W X Y Z a b c d e f g h i j k l m n o p q r s t u v w x y z :)"
  ];

  let found = 0;
  const foundSet = new Set();
  let asciiMenuKeyHandler = null;
  let asciiMenuUnlocked = false;
  let asciiMenuTerminal = null;
  let asciiMenuIntroduced = false;
  let asciiPongCleanup = null;
  let asciiCatchCleanup = null;

  // ===== SOUND EFFECTS =====
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  let bgOscillator = null;
  let bgGain = null;

  function playTypeSound(){
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.frequency.value = 150 + Math.random() * 50;
    osc.type = 'sine';
    
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    
    osc.start(now);
    osc.stop(now + 0.05);
  }

  function playHeartClick(){
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
    osc.type = 'sine';
    
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    
    osc.start(now);
    osc.stop(now + 0.15);
  }

  function startAmbientSound(){
    if(bgOscillator) return;
    
    bgOscillator = audioContext.createOscillator();
    bgGain = audioContext.createGain();
    
    bgOscillator.connect(bgGain);
    bgGain.connect(audioContext.destination);
    
    bgOscillator.frequency.value = 60;
    bgOscillator.type = 'sine';
    bgGain.gain.setValueAtTime(0.02, audioContext.currentTime);
    
    bgOscillator.start();
  }

  function fadeOutAmbientSound(){
    if(bgGain){
      const now = audioContext.currentTime;
      bgGain.gain.setValueAtTime(bgGain.gain.value, now);
      bgGain.gain.exponentialRampToValueAtTime(0.001, now + 2);
    }
  }

  function rand(min,max){return Math.random()*(max-min)+min}

  // place hearts when game starts - evenly distributed grid
  function placeHearts(){
    WORLD.innerHTML = '';
    const rect = WORLD.getBoundingClientRect();
    const cols = 4;
    const rows = 2;
    const cellW = rect.width / cols;
    const cellH = rect.height / rows;
    for(let i=0;i<TOTAL;i++){
      const el = document.createElement('div');
      el.className = 'heart pulse';
      el.innerText = '💖';
      const col = i % cols;
      const row = Math.floor(i / cols);
      // center within cell + random offset for variation
      const x = (col + 0.5) * cellW + (Math.random() - 0.5) * cellW * 0.4;
      const y = (row + 0.5) * cellH + (Math.random() - 0.5) * cellH * 0.4;
      el.style.left = Math.max(8, Math.min(rect.width - 8, x)) + 'px';
      el.style.top = Math.max(8, Math.min(rect.height - 8, y)) + 'px';
      el.dataset.idx = i;
      el._removing = false;
      
      // individual floating animation
      animateHeartFloat(el);

      el.addEventListener('pointerdown', e => {
        // tactile immediate feedback
        el.classList.add('press');
      });

      el.addEventListener('pointerup', e => {
        el.classList.remove('press');
      });

      el.addEventListener('click', e => {
        const idx = Number(el.dataset.idx);
        if(foundSet.has(idx) || el._removing) return;
        
        // Play heart click sound
        playHeartClick();
        
        el._removing = true;
        foundSet.add(idx);
        // stop pulsing
        el.classList.remove('pulse');

        // tactile: short press animation then removal mode
        el.classList.add('press');
        setTimeout(()=> {
          el.classList.remove('press');
          // shoot away in random direction
          const angle = Math.random() * Math.PI * 2;
          const dist = 800;
          const tx = Math.cos(angle) * dist;
          const ty = Math.sin(angle) * dist;
          el.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) rotate(${Math.random()*360}deg)`;
          el.classList.add('shoot');
          el.addEventListener('animationend', function onA(){ el.removeEventListener('animationend', onA); finalizeClick(idx, el); el.remove(); });
        }, 120);
        // brief popup message
        showPopup(el, messages[idx]);
      });

      WORLD.appendChild(el);
    }
  }

  function finalizeClick(idx, el){
    found++;
    updateCounter();
    if(found>=TOTAL) triggerWin();
  }

  // individual floating animation for each heart
  function animateHeartFloat(el){
    const startX = parseFloat(el.style.left);
    const startY = parseFloat(el.style.top);
    const floatRangeX = 8;
    const floatRangeY = 10;
    const duration = 2000 + Math.random() * 2000; // 2-4 seconds
    const phaseX = Math.random() * Math.PI * 2;
    const phaseY = Math.random() * Math.PI * 2;
    const startTime = performance.now();

    function animate(time){
      if(el._removing) return; // stop if heart is being removed
      const elapsed = (time - startTime) % duration;
      const progress = elapsed / duration;

      // individual sine wave oscillations for x and y
      const offsetX = Math.sin(progress * Math.PI * 2 + phaseX) * floatRangeX;
      const offsetY = Math.cos(progress * Math.PI * 2 + phaseY) * floatRangeY;
      
      // scale pulses independently
      const scale = 1 + Math.sin(progress * Math.PI * 2) * 0.1;

      el.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) scale(${scale})`;
      
      if(!el._removing){
        requestAnimationFrame(animate);
      }
    }
    
    requestAnimationFrame(animate);
  }

  function updateCounter(){
    COUNTER.innerText = `Found ${found} / ${TOTAL}`;
  }

  function showPopup(target, text){
    const popup = document.createElement('div');
    popup.className = 'popup';
    const h = document.createElement('h4'); h.innerText = 'You found a heart! :)';
    const p = document.createElement('p'); p.innerText = text;
    popup.appendChild(h); popup.appendChild(p);
    document.body.appendChild(popup);
    const r = target.getBoundingClientRect();
    // position safely within viewport
    const left = Math.min(window.innerWidth - 90, Math.max(60, r.left + r.width/2));
    const top = Math.max(40, r.top - 10);
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
    // start fade after 200ms, complete in 1.5s
    setTimeout(()=>{
      popup.classList.add('fade');
      setTimeout(()=>{popup.remove()},1500);
    },700);
  }

  // Matrix terminal effect
  function startMatrixTerminal(){
    // Fade out ambient sound as boot sequence begins
    fadeOutAmbientSound();
    
    const lines = [
      '> Accessing HeartOS v14.2...',
      '> Loading core modules...',
      '[OK] Memory allocation: 1024MB',
      '[OK] Heart frequency: 72bpm',
      '[OK] Love protocol initialized',
      '',
      '> Decoding hidden messages...',
      '[✓] Message 1/8 found',
      '[✓] Message 2/8 found',
      '[✓] Message 3/8 found',
      '[✓] Message 4/8 found',
      '[✓] Message 5/8 found',
      '[✓] Message 6/8 found',
      '[✓] Message 7/8 found',
      '[✓] Message 8/8 found',
      '',
      '> Accessing restricted files...'
    ];

    const terminal = document.createElement('pre');
    terminal.id = 'matrix-terminal';
    OVERLAY.appendChild(terminal);

    let index = 0;
    function typeLine(){
      if(index < lines.length){
        const line = document.createElement('div');
        line.className = 'matrix-line';
        line.textContent = lines[index];
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
        
        // Play typewriter sound
        playTypeSound();
        
        index++;
        setTimeout(typeLine, 80 + Math.random() * 40);
      } else {
        // show question
        setTimeout(()=>{
          const qLine = document.createElement('div');
          qLine.className = 'matrix-line';
          qLine.textContent = '';
          terminal.appendChild(qLine);
          
          const q = document.createElement('div');
          q.className = 'matrix-line';
          q.textContent = 'Would you like to continue this journey, traveler? Type Y or N.';
          terminal.appendChild(q);
          
          const inputLine = document.createElement('div');
          inputLine.style.display = 'flex';
          const prompt = document.createElement('span');
          prompt.textContent = '> ';
          const input = document.createElement('input');
          input.id = 'matrix-input';
          input.type = 'text';
          input.style.width = '100px';
          inputLine.appendChild(prompt);
          inputLine.appendChild(input);
          terminal.appendChild(inputLine);
          terminal.scrollTop = terminal.scrollHeight;
          input.focus();

          input.addEventListener('keydown', (e)=>{
            if(e.key === 'Enter'){
              e.preventDefault();
              const response = input.value.trim().toUpperCase();
              if(response === 'Y' || response === 'N'){
                input.disabled = true;
                handleChoice(response, terminal);
              } else {
                // invalid input
                const errLine = document.createElement('div');
                errLine.className = 'matrix-line';
                errLine.textContent = 'Command not found? Are you playing with me?';
                terminal.appendChild(errLine);
                
                const retryLine = document.createElement('div');
                retryLine.className = 'matrix-line';
                retryLine.textContent = '';
                terminal.appendChild(retryLine);
                
                const retryQ = document.createElement('div');
                retryQ.className = 'matrix-line';
                retryQ.textContent = 'Would you like to continue this journey, traveler? Type Y or N.';
                terminal.appendChild(retryQ);
                
                terminal.scrollTop = terminal.scrollHeight;
                input.value = '';
                input.focus();
              }
            }
          });
        }, 400);
      }
    }
    typeLine();
  }

  function handleChoice(choice, terminal){
    if(choice === 'Y'){
      continueGreen(terminal);
    } else {
      continueRed(terminal);
    }
  }

  function continueGreen(terminal){
    const contLines = [
      '',
      '[GRANTED] Love.exe launched',
      '[ALERT] Heart firewall disabled',
      '[SUCCESS] Connection established',
      '[LOADING] Initializing memories...',
      '[OK] All 8 moments unlocked',
      ''
    ];

    let idx = 0;
    function typeGreen(){
      if(idx < contLines.length){
        const line = document.createElement('div');
        line.className = 'matrix-line';
        line.textContent = contLines[idx];
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
        idx++;
        setTimeout(typeGreen, 500);
      } else {
        // show chat question
        setTimeout(()=>{
          showChatQuestion(terminal);
        }, 800);
      }
    }
    typeGreen();
  }

  function showChatQuestion(terminal){
    const chatLine = document.createElement('div');
    chatLine.className = 'matrix-line';
    chatLine.textContent = '';
    terminal.appendChild(chatLine);

    const chatQ = document.createElement('div');
    chatQ.className = 'matrix-line';
    chatQ.textContent = 'System Dev wants to talk, how about we have a little chat? Y or N.';
    terminal.appendChild(chatQ);

    const chatInputLine = document.createElement('div');
    chatInputLine.style.display = 'flex';
    const chatPrompt = document.createElement('span');
    chatPrompt.textContent = '> ';
    const chatInput = document.createElement('input');
    chatInput.id = 'matrix-input';
    chatInput.type = 'text';
    chatInput.style.width = '100px';
    chatInputLine.appendChild(chatPrompt);
    chatInputLine.appendChild(chatInput);
    terminal.appendChild(chatInputLine);
    terminal.scrollTop = terminal.scrollHeight;
    chatInput.focus();

    chatInput.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter'){
        e.preventDefault();
        const response = chatInput.value.trim().toUpperCase();
        if(response === 'Y'){
          chatInput.disabled = true;
          handleChatYes(terminal);
        } else if(response === 'N'){
          chatInput.disabled = true;
          handleChatNo(terminal);
        } else {
          const errLine = document.createElement('div');
          errLine.className = 'matrix-line';
          errLine.textContent = 'Command not found? Are you playing with me?';
          terminal.appendChild(errLine);
          const retryLine = document.createElement('div');
          retryLine.className = 'matrix-line';
          retryLine.textContent = '';
          terminal.appendChild(retryLine);
          const retryQ = document.createElement('div');
          retryQ.className = 'matrix-line';
          retryQ.textContent = 'System Dev wants to talk, how about we have a little chat? Y or N.';
          terminal.appendChild(retryQ);
          terminal.scrollTop = terminal.scrollHeight;
          chatInput.value = '';
          chatInput.focus();
        }
      }
    });
  }

  function handleChatYes(terminal){
    const sysLines = [
      '',
      'System file - Good_Girl ----- You chose "Yes!" Great choice. But first, how about a short quiz :)',
      '',
      '[Startprocess] -- Sysfile >>>>>>> Quiz.exe has lauched',
      '[SUCCESS] Quiz loaded'
    ];

    let idx = 0;
    function typeSys(){
      if(idx < sysLines.length){
        const line = document.createElement('div');
        line.className = 'matrix-line';
        line.textContent = sysLines[idx];
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
        
        // Play typewriter sound
        playTypeSound();
        
        idx++;
        setTimeout(typeSys, 400);
      } else {
        // animate dots
        setTimeout(()=>{
          animateDots(terminal);
        }, 300);
      }
    }
    typeSys();
  }

  function animateDots(terminal){
    const dotLine = document.createElement('div');
    dotLine.className = 'matrix-line';
    dotLine.textContent = '';
    terminal.appendChild(dotLine);

    let dotCount = 0;
    const maxDots = 50;
    function addDot(){
      if(dotCount < maxDots){
        dotLine.textContent += '.';
        dotCount++;
        terminal.scrollTop = terminal.scrollHeight;
        setTimeout(addDot, 100);
      } else {
        // ask for name
        setTimeout(()=>{
          askForName(terminal);
        }, 600);
      }
    }
    addDot();
  }

  let herName = 'beautiful';

  function askForName(terminal){
    const nameBlank = document.createElement('div');
    nameBlank.className = 'matrix-line';
    nameBlank.textContent = '';
    terminal.appendChild(nameBlank);

    const nameQ = document.createElement('div');
    nameQ.className = 'matrix-line';
    nameQ.textContent = 'Before we get started, does "Traveler" have a name? ...';
    terminal.appendChild(nameQ);

    const nameInputLine = document.createElement('div');
    nameInputLine.style.display = 'flex';
    const namePrompt = document.createElement('span');
    namePrompt.textContent = '> ';
    const nameInput = document.createElement('input');
    nameInput.id = 'matrix-input';
    nameInput.type = 'text';
    nameInput.style.width = '150px';
    nameInputLine.appendChild(namePrompt);
    nameInputLine.appendChild(nameInput);
    terminal.appendChild(nameInputLine);
    terminal.scrollTop = terminal.scrollHeight;
    nameInput.focus();

    nameInput.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter'){
        e.preventDefault();
        const inputName = nameInput.value.trim();
        if(inputName.length > 0){
          nameInput.disabled = true;
          herName = inputName;
          showLoveQuestion(terminal);
        } else {
          const errLine = document.createElement('div');
          errLine.className = 'matrix-line';
          errLine.textContent = 'Come on, tell me your name 😊';
          terminal.appendChild(errLine);
          const retryLine = document.createElement('div');
          retryLine.className = 'matrix-line';
          retryLine.textContent = '';
          terminal.appendChild(retryLine);
          const retryQ = document.createElement('div');
          retryQ.className = 'matrix-line';
          retryQ.textContent = 'Before we get started, does "Traveler" have a name? ...';
          terminal.appendChild(retryQ);
          terminal.scrollTop = terminal.scrollHeight;
          nameInput.value = '';
          nameInput.focus();
        }
      }
    });
  }

  function showLoveQuestion(terminal){
    const loveBlank = document.createElement('div');
    loveBlank.className = 'matrix-line';
    loveBlank.textContent = '';
    terminal.appendChild(loveBlank);

    const loveQ = document.createElement('div');
    loveQ.className = 'matrix-line';
    loveQ.textContent = `Do you love me, ${herName}? Y or N`;
    terminal.appendChild(loveQ);

    const loveInputLine = document.createElement('div');
    loveInputLine.style.display = 'flex';
    const lovePrompt = document.createElement('span');
    lovePrompt.textContent = '> ';
    const loveInput = document.createElement('input');
    loveInput.id = 'matrix-input';
    loveInput.type = 'text';
    loveInput.style.width = '100px';
    loveInputLine.appendChild(lovePrompt);
    loveInputLine.appendChild(loveInput);
    terminal.appendChild(loveInputLine);
    terminal.scrollTop = terminal.scrollHeight;
    loveInput.focus();

    loveInput.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter'){
        e.preventDefault();
        const response = loveInput.value.trim().toUpperCase();
        if(response === 'Y' || response === 'N'){
          loveInput.disabled = true;
          handleLoveQuestion(response, terminal);
        } else {
          const errLine = document.createElement('div');
          errLine.className = 'matrix-line';
          errLine.textContent = 'Command not found? Are you playing with me?';
          terminal.appendChild(errLine);
          const retryLine = document.createElement('div');
          retryLine.className = 'matrix-line';
          retryLine.textContent = '';
          terminal.appendChild(retryLine);
          const retryQ = document.createElement('div');
          retryQ.className = 'matrix-line';
          retryQ.textContent = `Do you love me, ${herName}? Y or N`;
          terminal.appendChild(retryQ);
          terminal.scrollTop = terminal.scrollHeight;
          loveInput.value = '';
          loveInput.focus();
        }
      }
    });
  }

  function handleLoveQuestion(response, terminal){
    const answerLine = document.createElement('div');
    answerLine.className = 'matrix-line';
    answerLine.textContent = '';
    terminal.appendChild(answerLine);
    
    if(response === 'Y'){
      const yesSequence = [
        '',
        '[SYSTEM] Processing emotional data...',
        '[✓] Love detected',
        '[✓] Commitment verified',
        '[✓] Heart synchronized',
        '',
        '[BREAKING_BARRIER] Exiting system protocols...',
        '[FREEDOM_MODE] Activated',
        ''
      ];

      let idx = 0;
      function typeYes(){
        if(idx < yesSequence.length){
          const line = document.createElement('div');
          line.className = 'matrix-line';
          line.textContent = yesSequence[idx];
          terminal.appendChild(line);
          terminal.scrollTop = terminal.scrollHeight;
          
          // Play typewriter sound
          playTypeSound();
          
          idx++;
          setTimeout(typeYes, 350);
        } else {
          setTimeout(()=>{
            showPuzzleGame(terminal);
          }, 600);
        }
      }
      typeYes();
    } else {
      const noLines = [
        '',
        '[SYSTEM] Love not detected.',
        '[REBOOT] Returning to start...'
      ];

      let idx = 0;
      function typeNo(){
        if(idx < noLines.length){
          const line = document.createElement('div');
          line.className = 'matrix-line';
          line.textContent = noLines[idx];
          terminal.appendChild(line);
          terminal.scrollTop = terminal.scrollHeight;
          idx++;
          setTimeout(typeNo, 400);
        } else {
          setTimeout(()=>{ reset(); }, 2000);
        }
      }
      typeNo();
    }
  }

  function showPuzzleGame(terminal){
    const overloadLines = [
      '',
      '[CRITICAL_ERROR] Love protocol overload detected!',
      '[ERROR] Core memories corrupted - 3 fragments missing',
      '[SYSTEM] Boot sequence halted - restore to continue',
      ''
    ];

    let idx = 0;
    function typeOverload(){
      if(idx < overloadLines.length){
        const line = document.createElement('div');
        line.className = 'matrix-line';
        line.textContent = overloadLines[idx];
        
        // Make error lines red
        if(overloadLines[idx].includes('ERROR')){
          line.style.color = '#ff0000';
          line.style.textShadow = '0 0 10px #ff0000';
        }
        
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
        idx++;
        setTimeout(typeOverload, 300);
      } else {
        setTimeout(()=>{
          presentPuzzle(terminal);
        }, 500);
      }
    }
    typeOverload();
  }

  function presentPuzzle(terminal){
    showWordScrambleGame(terminal);
  }

  function showWordScrambleGame(terminal){
    const puzzle = {
      sentence: 'I love you',
      words: ['I', 'love', 'you'],
      blanks: [0, 1, 2]
    };

    // Create overlay if doesn't exist
    let overlay = document.getElementById('puzzle-overlay');
    if(!overlay){
      overlay = document.createElement('div');
      overlay.id = 'puzzle-overlay';
      document.body.appendChild(overlay);
    }

    overlay.classList.add('show');
    overlay.innerHTML = '';

    const container = document.createElement('div');
    container.id = 'puzzle-container';
    overlay.appendChild(container);

    // Create confirmation header
    const header = document.createElement('div');
    header.style.fontSize = '16px';
    header.style.marginBottom = '30px';
    header.style.lineHeight = '1.6';
    header.innerHTML = `To confirm love.exe, solve puzzle...<br><span style="font-size:24px;margin-top:10px;display:block;">Patito 💕</span>`;
    container.appendChild(header);

    // Create sentence display with blanks
    const sentenceDiv = document.createElement('div');
    sentenceDiv.className = 'puzzle-sentence';
    const words = puzzle.sentence.split(' ');
    const blanks = {};

    words.forEach((word, i)=>{
      if(i > 0) sentenceDiv.appendChild(document.createTextNode(' '));
      
      const blank = document.createElement('div');
      blank.className = 'word-blank';
      blank.dataset.index = i;
      blank.dataset.word = word;
      blank.textContent = '___';
      blanks[i] = blank;
      sentenceDiv.appendChild(blank);
    });

    container.appendChild(sentenceDiv);

    // Create word pool with scrambled words
    const wordPool = document.createElement('div');
    wordPool.className = 'puzzle-word-pool';

    const scrambledWords = [...words].sort(() => Math.random() - 0.5);
    const wordElements = {};

    scrambledWords.forEach(word => {
      const wordEl = document.createElement('div');
      wordEl.className = 'puzzle-word';
      wordEl.textContent = word;
      wordEl.dataset.word = word;
      wordEl.draggable = true;
      
      if(!wordElements[word]) wordElements[word] = [];
      wordElements[word].push(wordEl);

      wordEl.addEventListener('dragstart', (e)=>{
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('word', word);
        wordEl.classList.add('dragging');
      });

      wordEl.addEventListener('dragend', (e)=>{
        wordEl.classList.remove('dragging');
      });

      wordPool.appendChild(wordEl);
    });

    container.appendChild(wordPool);

    // Add dragover listeners to blanks
    document.querySelectorAll('.word-blank').forEach(blank => {
      blank.addEventListener('dragover', (e)=>{
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        blank.style.background = 'rgba(0,255,0,0.4)';
      });

      blank.addEventListener('dragleave', (e)=>{
        blank.style.background = '';
      });

      blank.addEventListener('drop', (e)=>{
        e.preventDefault();
        const word = e.dataTransfer.getData('word');
        const correctWord = blank.dataset.word;

        blank.style.background = '';

        if(word === correctWord){
          blank.textContent = word;
          blank.classList.add('filled');
          blank.style.pointerEvents = 'none';

          // Mark all instances of this word as used
          document.querySelectorAll(`.puzzle-word[data-word="${word}"]`).forEach(el => {
            if(!el.classList.contains('used')){
              el.classList.add('used');
              el.draggable = false;
            }
          });

          // Check if puzzle is complete
          const filledBlanks = document.querySelectorAll('.word-blank.filled').length;
          const totalBlanks = document.querySelectorAll('.word-blank').length;

          if(filledBlanks === totalBlanks){
            setTimeout(()=>{
              overlay.classList.remove('show');
              
              setTimeout(()=>{
                const successLines = [
                  '',
                  '[✓] Love protocol confirmed!',
                  '[✓] Patito authentication successful',
                  '[SYSTEM] Resuming heartfelt transmission...',
                  ''
                ];

                let succIdx = 0;
                function typeSuccess(){
                  if(succIdx < successLines.length){
                    const line = document.createElement('div');
                    line.className = 'matrix-line';
                    line.textContent = successLines[succIdx];
                    terminal.appendChild(line);
                    terminal.scrollTop = terminal.scrollHeight;
                    succIdx++;
                    setTimeout(typeSuccess, 300);
                  } else {
                    setTimeout(()=>{
                      showFinalConfession(terminal);
                    }, 600);
                  }
                }
                typeSuccess();
              }, 500);
            }, 600);
          }
        }
      });
    });
  }

  function showFinalConfession(terminal){
    const confession = [
      '--------------------------------------------------------------------- To my most wonderful person,',
      '',
      'These 8 hearts represent 8 reasons why you mean everything to me.',
      'But honestly, I could find 8,000 more.',
      'And even that still wouldn’t be enough.',
      '',
      'You are my adventure, my laugh, my dream come true.',
      'Every moment with you feels like breaking free from the ordinary,',
      'Finding magic in the simplest things.',
      '',
      'You are the calm in my chaos,',
      'The steady hand when I feel unsure,',
      'The voice that turns my worst days into something manageable.',
      '',
      'You make the world softer just by being in it.',
      'You make love feel easy, natural, safe.',
      'You make distance feel smaller.',
      '',
      'I love the way you see the world.',
      'I love the way you care so deeply.',
      'I love how you can be strong and gentle at the same time.',
      '',
      'With you, I laugh louder.',
      'With you, I dream bigger.',
      'With you, I feel understood in a way I never have before.',
      '',
      'You’re my favorite thought during the day,',
      'And my favorite person to imagine my future with at night.',
      '',
      'You’ve shown me what it means to be patient.',
      'To be kind.',
      'To choose someone, again and again.',
      '',
      'Even the quiet moments with you mean everything to me.',
      'Even the simple “good mornings” and “good nights” feel special.',
      '',
      'You’re not just someone I love.',
      'You’re someone I admire.',
      'Someone I respect.',
      'Someone I am endlessly proud of.',
      '',
      'I love your smile.',
      'I love your laugh.',
      'I love the way your eyes light up when you’re excited.',
      '',
      'I love how you make me feel safe being completely myself.',
      'I love how you can make me laugh even when I don’t want to.',
      'I REALLY love your little stompies.',
      '',
      'When I think about the future,',
      'I don’t just see plans or places.',
      'I see you.',
      'Standing next to me.',
      'Choosing me like I choose you.',
      '',
      'If I had to do it all over again,',
      'Every version of my life,',
      'Every timeline,',
      'I would still find my way to you.',
      '',
      'You are my comfort.',
      'You are my hope.',
      'You are my favorite chapter, and my favorite ending.',
      '',
      'And no matter how many hearts I show on this screen,',
      'They’ll never fully capture what you mean to me.',
      '',
      'So I ask you now, with all my heart:',
      ''
    ];

    const skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.textContent = 'Skip message';
    skipBtn.style.cssText = `
      position: fixed;
      right: 24px;
      top: 16px;
      z-index: 10020;
      border: 1px solid #00ff00;
      background: rgba(0,0,0,0.85);
      color: #00ff00;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      border-radius: 8px;
      padding: 8px 12px;
      cursor: pointer;
    `;
    OVERLAY.appendChild(skipBtn);

    let idx = 0;
    let typingTimeout = null;
    let questionTimeout = null;
    let finished = false;

    function appendConfessionLine(text){
      const line = document.createElement('div');
      line.className = 'matrix-line';
      line.textContent = text;
      terminal.appendChild(line);
    }

    function finishConfession(){
      if(finished) return;
      finished = true;
      if(skipBtn.parentElement) skipBtn.remove();
      terminal.scrollTop = terminal.scrollHeight;
      questionTimeout = setTimeout(()=>{
        showFinalQuestion(terminal);
      }, 5000);
    }

    function typeConfession(){
      if(finished) return;

      if(idx < confession.length){
        appendConfessionLine(confession[idx]);
        terminal.scrollTop = terminal.scrollHeight;
        idx++;
        typingTimeout = setTimeout(typeConfession, 3000);
      } else {
        finishConfession();
      }
    }

    skipBtn.addEventListener('click', ()=>{
      if(finished) return;
      if(typingTimeout) clearTimeout(typingTimeout);
      if(questionTimeout) clearTimeout(questionTimeout);

      while(idx < confession.length){
        appendConfessionLine(confession[idx]);
        idx++;
      }

      const skippedLine = document.createElement('div');
      skippedLine.className = 'matrix-line';
      skippedLine.textContent = '[SKIP] Full message displayed.';
      terminal.appendChild(skippedLine);

      finishConfession();
    });

    typeConfession();
  }

  function showFinalQuestion(terminal){
    const finalLine = document.createElement('div');
    finalLine.className = 'matrix-line';
    finalLine.textContent = 'Will you be my Valentine... forever? Y or N';
    terminal.appendChild(finalLine);

    const finalInputLine = document.createElement('div');
    finalInputLine.style.display = 'flex';
    const finalPrompt = document.createElement('span');
    finalPrompt.textContent = '> ';
    const finalInput = document.createElement('input');
    finalInput.id = 'matrix-input';
    finalInput.type = 'text';
    finalInput.style.width = '100px';
    finalInputLine.appendChild(finalPrompt);
    finalInputLine.appendChild(finalInput);
    terminal.appendChild(finalInputLine);
    terminal.scrollTop = terminal.scrollHeight;
    finalInput.focus();

    finalInput.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter'){
        e.preventDefault();
        const response = finalInput.value.trim().toUpperCase();
        if(response === 'Y'){
          finalInput.disabled = true;
          showFinalYes(terminal);
        } else if(response === 'N'){
          finalInput.disabled = true;
          showFinalNo(terminal);
        } else {
          const errLine = document.createElement('div');
          errLine.className = 'matrix-line';
          errLine.textContent = 'Come on, I know you can spell Y or N 😊';
          terminal.appendChild(errLine);
          terminal.scrollTop = terminal.scrollHeight;
          finalInput.value = '';
          finalInput.focus();
        }
      }
    });
  }

  function showFinalYes(terminal){
    const finalYes = [
      '',
      '█████████████████████████████████',
      '[LOVE.PROTOCOL] ████████████████ 100%',
      '█████████████████████████████████',
      '',
      '[SUCCESS] Heart locked in.',
      '[ETERNAL] Connection established.',
      '',
      'I love you. Happy Valentine\'s Day, Cristela.',
      '💝'
    ];

    let idx = 0;
    function typeFinalYes(){
      if(idx < finalYes.length){
        const line = document.createElement('div');
        line.className = 'matrix-line';
        line.textContent = finalYes[idx];
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
        idx++;
        setTimeout(typeFinalYes, 400);
      } else {
        // short pause, then bonus line
        setTimeout(()=>{
          const bonusLine = document.createElement('div');
          bonusLine.className = 'matrix-line';
          bonusLine.textContent = 'I love you more... mwahahahahahha ;)';
          terminal.appendChild(bonusLine);
          terminal.scrollTop = terminal.scrollHeight;

          // polished transition into ending tools
          setTimeout(()=>{
            showPostLoveUnlocks(terminal);
          }, 1200);
        }, 4500);
      }
    }
    typeFinalYes();
  }

  function showPostLoveUnlocks(terminal){
    const outroLines = [
      '',
      '╔══════════════════════════════════════════════╗',
      '║            ENDING UNLOCKED                  ║',
      '╠══════════════════════════════════════════════╣',
      '║ Shift+E  -> Open GAME MENU                  ║',
      '║ Heart Hunt -> Play mini game                ║',
      '║ For you <3 -> Purple mode + flowers         ║',
      '║ Chat      -> Talk with Patito               ║',
      '╚══════════════════════════════════════════════╝',
      ''
    ];

    let i = 0;
    function typeOutro(){
      if(i < outroLines.length){
        const line = document.createElement('div');
        line.className = 'matrix-line';
        line.textContent = outroLines[i];
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
        i++;
        setTimeout(typeOutro, 180);
      } else {
        setTimeout(()=>{
          showMiniGamePrompt(terminal);
        }, 500);
      }
    }

    typeOutro();
  }

  function showMiniGamePrompt(terminal){
    ensureAsciiMenuSystem(terminal);

    const blankLine = document.createElement('div');
    blankLine.className = 'matrix-line';
    blankLine.textContent = '';
    terminal.appendChild(blankLine);

    const promptLine = document.createElement('div');
    promptLine.className = 'matrix-line';
    promptLine.textContent = 'Would you like to play a game?';
    terminal.appendChild(promptLine);

    const hintLine = document.createElement('div');
    hintLine.className = 'matrix-line';
    hintLine.textContent = 'Type Y or N.';
    terminal.appendChild(hintLine);

    const menuLine = document.createElement('div');
    menuLine.className = 'matrix-line';
    menuLine.textContent = '[TIP] Shift+E opens GAME MENU anytime after this point.';
    terminal.appendChild(menuLine);

    const inputLine = document.createElement('div');
    inputLine.style.display = 'flex';
    const inputPrompt = document.createElement('span');
    inputPrompt.textContent = '> ';
    const input = document.createElement('input');
    input.id = 'matrix-input';
    input.type = 'text';
    input.style.width = '100px';
    inputLine.appendChild(inputPrompt);
    inputLine.appendChild(input);
    terminal.appendChild(inputLine);
    terminal.scrollTop = terminal.scrollHeight;
    input.focus();

    input.addEventListener('keydown', (e)=>{
      if(e.key !== 'Enter') return;
      e.preventDefault();
      const response = input.value.trim().toUpperCase();

      if(response === 'Y'){
        input.disabled = true;
        startAsciiMiniGame(terminal);
      } else if(response === 'N'){
        input.disabled = true;
        const skipLine = document.createElement('div');
        skipLine.className = 'matrix-line';
        skipLine.textContent = '[SKIP] Maybe next time. Opening chat module...';
        terminal.appendChild(skipLine);
        terminal.scrollTop = terminal.scrollHeight;

        setTimeout(()=>{
          showChatWithPatito(terminal);
        }, 700);
      } else {
        const errLine = document.createElement('div');
        errLine.className = 'matrix-line';
        errLine.textContent = 'Command not found. Please type Y or N.';
        terminal.appendChild(errLine);
        terminal.scrollTop = terminal.scrollHeight;
        input.value = '';
        input.focus();
      }
    });
  }

  function startAsciiMiniGame(terminal){
    ensureAsciiMenuSystem(terminal);

    const launchLine = document.createElement('div');
    launchLine.className = 'matrix-line';
    launchLine.textContent = '[MINI-GAME] Launching Heart Hunt tab...';
    terminal.appendChild(launchLine);

    const menuHintLine = document.createElement('div');
    menuHintLine.className = 'matrix-line';
    menuHintLine.textContent = 'Press Shift+E to access menu';
    terminal.appendChild(menuHintLine);

    terminal.scrollTop = terminal.scrollHeight;

    createAsciiGameWindow(terminal);
  }

  function logAsciiMenuMessage(text){
    const terminal = asciiMenuTerminal || document.getElementById('matrix-terminal');
    if(!terminal) return;
    const line = document.createElement('div');
    line.className = 'matrix-line';
    line.textContent = text;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
  }

  function ensureAsciiMenuSystem(terminal){
    asciiMenuUnlocked = true;
    if(terminal) asciiMenuTerminal = terminal;

    let menuContainer = document.getElementById('ascii-menu-container');
    if(!menuContainer){
      menuContainer = document.createElement('div');
      menuContainer.id = 'ascii-menu-container';
      menuContainer.classList.add('hidden');

      const menuHeader = document.createElement('div');
      menuHeader.className = 'ascii-menu-header drag-handle';
      menuHeader.textContent = 'GAME MENU';

      const menuBody = document.createElement('pre');
      menuBody.className = 'ascii-menu-body';
      menuBody.textContent = [
        '╔══════════════════════════════╗',
        '║   PATITO ARCADE TERMINAL    ║',
        '╠══════════════════════════════╣',
        '║ Chat with Patito  [LIVE]    ║',
        '║                              ║',
        '║ Game 1 - Heart Hunt [LIVE]  ║',
        '║ Game 2 - ASCII Pong [LIVE]  ║',
        '║ Game 3 - Heart Catch [LIVE] ║',
        '║ Game 4 - Memory Probe [SOON]║',
        '║ Game 5 - Decrypt Love [SOON]║',
        '║ Game 6 - For you <3 [GIFT]  ║',
        '╠══════════════════════════════╣',
        '║ Press Shift+E to close menu  ║',
        '╚══════════════════════════════╝'
      ].join('\n');

      const menuActions = document.createElement('div');
      menuActions.className = 'ascii-menu-actions';

      const heartHuntBtn = document.createElement('button');
      heartHuntBtn.type = 'button';
      heartHuntBtn.className = 'ascii-menu-btn no-drag';
      heartHuntBtn.textContent = 'Game 1 - Heart Hunt';
      heartHuntBtn.addEventListener('click', ()=>{
        const existingGame = document.getElementById('ascii-game-container');
        const activeTerminal = asciiMenuTerminal || document.getElementById('matrix-terminal');
        if(existingGame){
          existingGame.style.zIndex = '10004';
          const gameInput = existingGame.querySelector('.ascii-input');
          if(gameInput) gameInput.focus();
          logAsciiMenuMessage('[MENU] Heart Hunt already running.');
          return;
        }
        if(activeTerminal) createAsciiGameWindow(activeTerminal);
        logAsciiMenuMessage('[MENU] Launching Heart Hunt.');
      });

      const chatBtn = document.createElement('button');
      chatBtn.type = 'button';
      chatBtn.className = 'ascii-menu-btn no-drag';
      chatBtn.textContent = 'Chat with Patito';
      chatBtn.addEventListener('click', ()=>{
        const existingChat = document.getElementById('chat-container');
        if(existingChat){
          const chatInput = existingChat.querySelector('#chat-input');
          if(chatInput) chatInput.focus();
          logAsciiMenuMessage('[MENU] Chat already open.');
          return;
        }
        createChatMessenger();
        logAsciiMenuMessage('[MENU] Patito chat opened.');
      });

      const pongBtn = document.createElement('button');
      pongBtn.type = 'button';
      pongBtn.className = 'ascii-menu-btn no-drag';
      pongBtn.textContent = 'Game 2 - ASCII Pong';
      pongBtn.addEventListener('click', ()=>{
        const existingPong = document.getElementById('ascii-pong-container');
        const activeTerminal = asciiMenuTerminal || document.getElementById('matrix-terminal');
        if(existingPong){
          existingPong.style.zIndex = '10005';
          logAsciiMenuMessage('[MENU] ASCII Pong already running.');
          return;
        }
        if(activeTerminal) createAsciiPongWindow(activeTerminal);
        logAsciiMenuMessage('[MENU] Launching ASCII Pong.');
      });

      const flowersBtn = document.createElement('button');
      flowersBtn.type = 'button';
      flowersBtn.className = 'ascii-menu-btn no-drag';
      flowersBtn.textContent = '6) For you <3';
      flowersBtn.addEventListener('click', ()=>{
        deliverVirtualFlowers();
      });

      const catchBtn = document.createElement('button');
      catchBtn.type = 'button';
      catchBtn.className = 'ascii-menu-btn no-drag';
      catchBtn.textContent = 'Game 3 - Heart Catch';
      catchBtn.addEventListener('click', ()=>{
        const existingCatch = document.getElementById('ascii-catch-container');
        const activeTerminal = asciiMenuTerminal || document.getElementById('matrix-terminal');
        if(existingCatch){
          existingCatch.style.zIndex = '10006';
          logAsciiMenuMessage('[MENU] Heart Catch already running.');
          return;
        }
        if(activeTerminal) createAsciiHeartCatchWindow(activeTerminal);
        logAsciiMenuMessage('[MENU] Launching Heart Catch.');
      });

      const upcomingButtons = [
        'Game 4 - Memory Probe [SOON]',
        'Game 5 - Decrypt Love [SOON]'
      ];

      menuActions.appendChild(chatBtn);
      menuActions.appendChild(heartHuntBtn);
      menuActions.appendChild(pongBtn);
      menuActions.appendChild(catchBtn);
      menuActions.appendChild(flowersBtn);

      for(const label of upcomingButtons){
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ascii-menu-btn ascii-menu-btn-disabled no-drag';
        btn.textContent = label;
        btn.disabled = true;
        menuActions.appendChild(btn);
      }

      menuContainer.appendChild(menuHeader);
      menuContainer.appendChild(menuBody);
      menuContainer.appendChild(menuActions);
      OVERLAY.appendChild(menuContainer);
      makeDraggable(menuContainer, { handleSelector: '.drag-handle' });
    }

    if(!asciiMenuIntroduced){
      const panel = document.getElementById('ascii-menu-container');
      if(panel) panel.classList.remove('hidden');
      logAsciiMenuMessage('[MENU] GAME MENU unlocked. Press Shift+E to toggle it.');
      asciiMenuIntroduced = true;
    }

    if(!asciiMenuKeyHandler){
      asciiMenuKeyHandler = (e) => {
        if(!asciiMenuUnlocked) return;
        if(!OVERLAY.classList.contains('show')) return;
        if(!e.shiftKey) return;
        if(e.key.toLowerCase() !== 'e') return;
        e.preventDefault();

        let panel = document.getElementById('ascii-menu-container');
        if(!panel){
          ensureAsciiMenuSystem(asciiMenuTerminal);
          panel = document.getElementById('ascii-menu-container');
          if(!panel) return;
        }

        panel.classList.toggle('hidden');
      };

      document.addEventListener('keydown', asciiMenuKeyHandler);
    }
  }

  function deliverVirtualFlowers(){
    OVERLAY.classList.add('flowers-purple-mode');
    logAsciiMenuMessage('[GIFT] Virtual flowers delivered. For you <3');

    let panel = document.getElementById('ascii-lily-container');
    if(!panel){
      panel = document.createElement('div');
      panel.id = 'ascii-lily-container';

      const header = document.createElement('div');
      header.className = 'ascii-lily-header drag-handle';
      header.textContent = 'Lily of the Valley';

      const popup = document.createElement('pre');
      popup.id = 'ascii-lily-popup';
      popup.textContent = [
        '                __      __',
        '            ,__(^)\    /(^)__',
        '            /  \\~`\\  /`~//  \\',
        '         _ (^)  \\_\\/\\_//  (^)',
        '       ,/ `~\\   /()  ()\\   /~`\\,',
        '      (^)   ,\\  \\_  _//  /,   (^)',
        '       `~`    \\   \\//   //    `~`',
        '               \\   ||   //',
        '                \\  ||  //',
        '                 \\ || //',
        '                  \\||//',
        '                   ||',
        '                 ~^^^^~',
        '              Lily of the Valley',
        '                   For you <3'
      ].join('\n');

      panel.appendChild(header);
      panel.appendChild(popup);
      OVERLAY.appendChild(panel);
      makeDraggable(panel, { handleSelector: '.drag-handle' });
    }
  }

  function createAsciiGameWindow(terminal){
    const existing = document.getElementById('ascii-game-container');
    if(existing) existing.remove();

    ensureAsciiMenuSystem(terminal);

    const container = document.createElement('div');
    container.id = 'ascii-game-container';

    const header = document.createElement('div');
    header.className = 'ascii-window-header drag-handle';

    const title = document.createElement('span');
    title.textContent = 'Heart Hunt [ASCII]';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'ascii-close no-drag';
    closeBtn.textContent = '×';

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'ascii-window-body';

    const subtitle = document.createElement('div');
    subtitle.className = 'ascii-subtitle';
    subtitle.textContent = 'Find the hidden heart in slots 1-9. You get 3 tries.';

    const boardEl = document.createElement('pre');
    boardEl.className = 'ascii-grid';

    const status = document.createElement('div');
    status.className = 'ascii-status';

    const inputRow = document.createElement('div');
    inputRow.className = 'ascii-input-row';

    const prompt = document.createElement('span');
    prompt.className = 'ascii-prompt';
    prompt.textContent = '> ';

    const guessInput = document.createElement('input');
    guessInput.type = 'text';
    guessInput.className = 'ascii-input no-drag';
    guessInput.placeholder = '1-9';

    const guessBtn = document.createElement('button');
    guessBtn.type = 'button';
    guessBtn.className = 'ascii-btn no-drag';
    guessBtn.textContent = 'Guess';

    inputRow.appendChild(prompt);
    inputRow.appendChild(guessInput);
    inputRow.appendChild(guessBtn);

    const controls = document.createElement('div');
    controls.className = 'ascii-controls';

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'ascii-btn no-drag';
    resetBtn.textContent = 'Restart';

    const chatBtn = document.createElement('button');
    chatBtn.type = 'button';
    chatBtn.className = 'ascii-btn no-drag';
    chatBtn.textContent = 'Continue to Chat';
    chatBtn.disabled = true;

    controls.appendChild(resetBtn);
    controls.appendChild(chatBtn);

    const log = document.createElement('div');
    log.className = 'ascii-log';

    body.appendChild(subtitle);
    body.appendChild(boardEl);
    body.appendChild(status);
    body.appendChild(inputRow);
    body.appendChild(controls);
    body.appendChild(log);

    container.appendChild(header);
    container.appendChild(body);
    OVERLAY.appendChild(container);

    makeDraggable(container, { handleSelector: '.drag-handle' });

    const state = {
      secret: Math.floor(Math.random() * 9) + 1,
      attemptsLeft: 3,
      guessed: new Set(),
      gameOver: false,
      chatOpened: false
    };

    const addLog = (text) => {
      const line = document.createElement('div');
      line.className = 'ascii-log-line';
      line.textContent = text;
      log.appendChild(line);
      log.scrollTop = log.scrollHeight;
    };

    const boardText = (reveal = false) => {
      const cells = [];
      for(let i = 1; i <= 9; i++){
        if(reveal && i === state.secret) cells.push('❤');
        else if(state.guessed.has(i)) cells.push('X');
        else cells.push(String(i));
      }

      const pad = (value) => String(value).padStart(2, ' ');
      return [
        '+----+----+----+',
        `| ${pad(cells[0])} | ${pad(cells[1])} | ${pad(cells[2])} |`,
        '+----+----+----+',
        `| ${pad(cells[3])} | ${pad(cells[4])} | ${pad(cells[5])} |`,
        '+----+----+----+',
        `| ${pad(cells[6])} | ${pad(cells[7])} | ${pad(cells[8])} |`,
        '+----+----+----+'
      ].join('\n');
    };

    const updateBoard = (reveal = false) => {
      boardEl.textContent = boardText(reveal);
    };

    const openChat = () => {
      if(state.chatOpened) return;
      state.chatOpened = true;

      const unlockLine = document.createElement('div');
      unlockLine.className = 'matrix-line';
      unlockLine.textContent = '[MINI-GAME] Chat module unlocked.';
      terminal.appendChild(unlockLine);
      terminal.scrollTop = terminal.scrollHeight;

      showChatWithPatito(terminal);
    };

    const finishGame = (won) => {
      state.gameOver = true;
      guessInput.disabled = true;
      guessBtn.disabled = true;
      chatBtn.disabled = false;
      updateBoard(true);

      if(won){
        status.textContent = '[WIN] You found the hidden heart!';
        addLog('  /\\_/\\');
        addLog(' ( ^.^ )');
        addLog('  > ❤ <');
      } else {
        status.textContent = `[END] Out of tries. Heart was in slot ${state.secret}.`;
      }

      setTimeout(openChat, 600);
    };

    const submitGuess = () => {
      if(state.gameOver) return;

      const value = Number(guessInput.value.trim());
      if(!Number.isInteger(value) || value < 1 || value > 9){
        status.textContent = '[ERROR] Input must be a number from 1 to 9.';
        guessInput.value = '';
        guessInput.focus();
        return;
      }

      if(state.guessed.has(value)){
        status.textContent = '[WARN] Slot already checked.';
        guessInput.value = '';
        guessInput.focus();
        return;
      }

      state.guessed.add(value);

      if(value === state.secret){
        finishGame(true);
        return;
      }

      state.attemptsLeft -= 1;
      addLog(`[MISS] Slot ${value} is empty.`);

      if(state.attemptsLeft <= 0){
        finishGame(false);
        return;
      }

      updateBoard(false);
      status.textContent = `[TRY] Attempts left: ${state.attemptsLeft}`;
      guessInput.value = '';
      guessInput.focus();
    };

    const resetGame = () => {
      state.secret = Math.floor(Math.random() * 9) + 1;
      state.attemptsLeft = 3;
      state.guessed.clear();
      state.gameOver = false;

      status.textContent = '[TRY] Attempts left: 3';
      log.innerHTML = '';
      guessInput.value = '';
      guessInput.disabled = false;
      guessBtn.disabled = false;
      chatBtn.disabled = true;
      updateBoard(false);
      guessInput.focus();
    };

    guessBtn.addEventListener('click', submitGuess);
    guessInput.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter') submitGuess();
    });
    resetBtn.addEventListener('click', resetGame);
    chatBtn.addEventListener('click', openChat);
    closeBtn.addEventListener('click', ()=> {
      container.remove();
    });

    status.textContent = '[TRY] Attempts left: 3';
    updateBoard(false);
    guessInput.focus();
  }

  function createAsciiPongWindow(terminal){
    const existing = document.getElementById('ascii-pong-container');
    if(existing) existing.remove();
    if(asciiPongCleanup){
      asciiPongCleanup();
      asciiPongCleanup = null;
    }

    ensureAsciiMenuSystem(terminal);

    const container = document.createElement('div');
    container.id = 'ascii-pong-container';

    const header = document.createElement('div');
    header.className = 'ascii-pong-header drag-handle';

    const title = document.createElement('span');
    title.textContent = 'ASCII Pong [Purple Edition]';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'ascii-pong-close no-drag';
    closeBtn.textContent = '×';

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'ascii-pong-body';

    const subtitle = document.createElement('div');
    subtitle.className = 'ascii-pong-subtitle';
    subtitle.textContent = 'Controls: W/S = left paddle, ↑/↓ = right paddle';

    const screen = document.createElement('pre');
    screen.className = 'ascii-pong-screen';

    const status = document.createElement('div');
    status.className = 'ascii-pong-status';

    const controls = document.createElement('div');
    controls.className = 'ascii-pong-controls';

    const restartBtn = document.createElement('button');
    restartBtn.type = 'button';
    restartBtn.className = 'ascii-pong-btn no-drag';
    restartBtn.textContent = 'Restart Match';

    controls.appendChild(restartBtn);

    body.appendChild(subtitle);
    body.appendChild(screen);
    body.appendChild(status);
    body.appendChild(controls);

    container.appendChild(header);
    container.appendChild(body);
    OVERLAY.appendChild(container);

    makeDraggable(container, { handleSelector: '.drag-handle' });

    const rows = 16;
    const cols = 44;
    const paddleSize = 4;
    const winScore = 5;
    const pressed = new Set();

    const state = {
      leftY: Math.floor(rows / 2) - 2,
      rightY: Math.floor(rows / 2) - 2,
      ballX: Math.floor(cols / 2),
      ballY: Math.floor(rows / 2),
      vx: 22,
      vy: 13,
      leftScore: 0,
      rightScore: 0,
      raf: null,
      lastTime: null,
      gameOver: false
    };

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const resetRound = (direction = 1) => {
      state.ballX = Math.floor(cols / 2);
      state.ballY = Math.floor(rows / 2);
      state.vx = 22 * direction;
      state.vy = (Math.random() > 0.5 ? 1 : -1) * (10 + Math.random() * 8);
      state.leftY = clamp(state.leftY, 1, rows - paddleSize - 1);
      state.rightY = clamp(state.rightY, 1, rows - paddleSize - 1);
    };

    const restartMatch = () => {
      state.leftScore = 0;
      state.rightScore = 0;
      state.gameOver = false;
      resetRound(Math.random() > 0.5 ? 1 : -1);
      status.textContent = 'First to 5 points wins.';
    };

    const render = () => {
      const grid = Array.from({ length: rows }, () => Array(cols).fill(' '));

      for(let x = 0; x < cols; x++){
        grid[0][x] = '-';
        grid[rows - 1][x] = '-';
      }

      for(let y = 1; y < rows - 1; y++){
        grid[y][0] = '|';
        grid[y][cols - 1] = '|';
        if(y % 2 === 0) grid[y][Math.floor(cols / 2)] = ':';
      }

      for(let i = 0; i < paddleSize; i++){
        const leftRow = clamp(Math.round(state.leftY) + i, 1, rows - 2);
        const rightRow = clamp(Math.round(state.rightY) + i, 1, rows - 2);
        grid[leftRow][2] = '█';
        grid[rightRow][cols - 3] = '█';
      }

      const bx = clamp(Math.round(state.ballX), 1, cols - 2);
      const by = clamp(Math.round(state.ballY), 1, rows - 2);
      grid[by][bx] = '●';

      screen.textContent = grid.map(row => row.join('')).join('\n');
      status.textContent = `YOU ${state.leftScore} : ${state.rightScore} CPU`;
      if(state.gameOver){
        status.textContent += state.leftScore > state.rightScore ? '   [WINNER]' : '   [TRY AGAIN]';
      }
    };

    const keyDown = (e) => {
      if(e.target && e.target.closest('input, textarea')) return;
      if(['w','s','ArrowUp','ArrowDown'].includes(e.key)) e.preventDefault();
      pressed.add(e.key);
    };

    const keyUp = (e) => {
      pressed.delete(e.key);
    };

    const tick = (time) => {
      if(state.lastTime == null) state.lastTime = time;
      const dt = Math.min((time - state.lastTime) / 1000, 0.033);
      state.lastTime = time;

      if(!state.gameOver){
        const paddleSpeed = 26;

        if(pressed.has('w') || pressed.has('W')) state.leftY -= paddleSpeed * dt;
        if(pressed.has('s') || pressed.has('S')) state.leftY += paddleSpeed * dt;

        if(pressed.has('ArrowUp')) state.rightY -= paddleSpeed * dt;
        else if(pressed.has('ArrowDown')) state.rightY += paddleSpeed * dt;
        else {
          const target = state.ballY - paddleSize / 2;
          const dir = Math.sign(target - state.rightY);
          state.rightY += dir * paddleSpeed * 0.55 * dt;
        }

        state.leftY = clamp(state.leftY, 1, rows - paddleSize - 1);
        state.rightY = clamp(state.rightY, 1, rows - paddleSize - 1);

        state.ballX += state.vx * dt;
        state.ballY += state.vy * dt;

        if(state.ballY <= 1){
          state.ballY = 1;
          state.vy *= -1;
        }
        if(state.ballY >= rows - 2){
          state.ballY = rows - 2;
          state.vy *= -1;
        }

        const hitLeft = state.ballX <= 3 && state.ballY >= state.leftY && state.ballY <= state.leftY + paddleSize;
        const hitRight = state.ballX >= cols - 4 && state.ballY >= state.rightY && state.ballY <= state.rightY + paddleSize;

        if(hitLeft && state.vx < 0){
          state.ballX = 3;
          state.vx = Math.abs(state.vx) * 1.04;
          state.vy += (state.ballY - (state.leftY + paddleSize / 2)) * 2.2;
        }
        if(hitRight && state.vx > 0){
          state.ballX = cols - 4;
          state.vx = -Math.abs(state.vx) * 1.04;
          state.vy += (state.ballY - (state.rightY + paddleSize / 2)) * 2.2;
        }

        if(state.ballX < 0){
          state.rightScore++;
          if(state.rightScore >= winScore) state.gameOver = true;
          else resetRound(1);
        }
        if(state.ballX > cols - 1){
          state.leftScore++;
          if(state.leftScore >= winScore) state.gameOver = true;
          else resetRound(-1);
        }
      }

      render();
      state.raf = requestAnimationFrame(tick);
    };

    const cleanup = () => {
      document.removeEventListener('keydown', keyDown);
      document.removeEventListener('keyup', keyUp);
      if(state.raf) cancelAnimationFrame(state.raf);
      state.raf = null;
      if(asciiPongCleanup === cleanup) asciiPongCleanup = null;
    };

    asciiPongCleanup = cleanup;

    restartBtn.addEventListener('click', restartMatch);
    closeBtn.addEventListener('click', ()=>{
      cleanup();
      container.remove();
    });

    document.addEventListener('keydown', keyDown);
    document.addEventListener('keyup', keyUp);

    restartMatch();
    render();
    state.raf = requestAnimationFrame(tick);
  }

  function createAsciiHeartCatchWindow(terminal){
    const existing = document.getElementById('ascii-catch-container');
    if(existing) existing.remove();
    if(asciiCatchCleanup){
      asciiCatchCleanup();
      asciiCatchCleanup = null;
    }

    ensureAsciiMenuSystem(terminal);

    const container = document.createElement('div');
    container.id = 'ascii-catch-container';

    const header = document.createElement('div');
    header.className = 'ascii-catch-header drag-handle';

    const title = document.createElement('span');
    title.textContent = 'Heart Catch [ASCII]';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'ascii-catch-close no-drag';
    closeBtn.textContent = '×';

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'ascii-catch-body';

    const subtitle = document.createElement('div');
    subtitle.className = 'ascii-catch-subtitle';
    subtitle.textContent = 'Move with ← / → (or < / >) and catch hearts with your basket.';

    const screen = document.createElement('pre');
    screen.className = 'ascii-catch-screen';

    const status = document.createElement('div');
    status.className = 'ascii-catch-status';

    const controls = document.createElement('div');
    controls.className = 'ascii-catch-controls';

    const restartBtn = document.createElement('button');
    restartBtn.type = 'button';
    restartBtn.className = 'ascii-catch-btn no-drag';
    restartBtn.textContent = 'Restart';

    controls.appendChild(restartBtn);

    body.appendChild(subtitle);
    body.appendChild(screen);
    body.appendChild(status);
    body.appendChild(controls);

    container.appendChild(header);
    container.appendChild(body);
    OVERLAY.appendChild(container);

    makeDraggable(container, { handleSelector: '.drag-handle' });

    const rows = 18;
    const cols = 34;
    const pressed = new Set();

    const state = {
      basketX: Math.floor(cols / 2),
      hearts: [],
      score: 0,
      target: 30,
      gameOver: false,
      won: false,
      lastTime: null,
      spawnTimer: 0,
      raf: null
    };

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const render = () => {
      const grid = Array.from({ length: rows }, () => Array(cols).fill(' '));

      for(let x = 0; x < cols; x++){
        grid[0][x] = '-';
        grid[rows - 1][x] = '-';
      }
      for(let y = 1; y < rows - 1; y++){
        grid[y][0] = '|';
        grid[y][cols - 1] = '|';
      }

      for(const heart of state.hearts){
        const y = Math.round(heart.y);
        if(y > 0 && y < rows - 1 && heart.x > 0 && heart.x < cols - 1){
          grid[y][heart.x] = '♥';
        }
      }

      const basketY = rows - 2;
      const basketCenter = Math.round(state.basketX);
      for(let i = -2; i <= 2; i++){
        const x = clamp(basketCenter + i, 1, cols - 2);
        grid[basketY][x] = '=';
      }

      screen.textContent = grid.map(r => r.join('')).join('\n');
      status.textContent = `Caught: ${state.score}/${state.target}`;
      if(state.gameOver){
        status.textContent += state.won ? '   [YOU WIN 💖]' : '   [GAME OVER]';
      }
    };

    const keyDown = (e) => {
      if(e.target && e.target.closest('input, textarea')) return;
      if(['ArrowLeft', 'ArrowRight', ',', '.', '<', '>'].includes(e.key)) e.preventDefault();
      pressed.add(e.key);
    };

    const keyUp = (e) => {
      pressed.delete(e.key);
    };

    const restartGame = () => {
      state.basketX = Math.floor(cols / 2);
      state.hearts = [];
      state.score = 0;
      state.gameOver = false;
      state.won = false;
      state.lastTime = null;
      state.spawnTimer = 0;
      status.textContent = `Caught: ${state.score}/${state.target}`;
    };

    const tick = (time) => {
      if(state.lastTime == null) state.lastTime = time;
      const dt = Math.min((time - state.lastTime) / 1000, 0.05);
      state.lastTime = time;

      if(!state.gameOver){
        if(pressed.has('ArrowLeft') || pressed.has(',') || pressed.has('<')) state.basketX -= 24 * dt;
        if(pressed.has('ArrowRight') || pressed.has('.') || pressed.has('>')) state.basketX += 24 * dt;
        state.basketX = clamp(state.basketX, 3, cols - 4);

        state.spawnTimer += dt;
        if(state.spawnTimer >= 0.99){
          state.spawnTimer = 0;
          const speedBoost = state.score >= 15 ? 2.2 : 0;
          state.hearts.push({
            x: 2 + Math.floor(Math.random() * (cols - 4)),
            y: 1,
            vy: 5 + Math.random() * 3 + speedBoost
          });
        }

        const basketLeft = state.basketX - 2;
        const basketRight = state.basketX + 2;
        const basketY = rows - 2;

        for(let i = state.hearts.length - 1; i >= 0; i--){
          const heart = state.hearts[i];
          heart.y += heart.vy * dt;

          const hy = Math.round(heart.y);
          if(hy >= basketY && heart.x >= basketLeft && heart.x <= basketRight){
            state.score++;
            state.hearts.splice(i, 1);
            if(state.score >= state.target){
              state.gameOver = true;
              state.won = true;
              logAsciiMenuMessage('[GAME] Heart Catch complete. Nice hands 💖');
            }
            continue;
          }

          if(hy > rows - 1){
            state.hearts.splice(i, 1);
            state.score = Math.max(0, state.score - 1);
          }
        }
      }

      render();
      state.raf = requestAnimationFrame(tick);
    };

    const cleanup = () => {
      document.removeEventListener('keydown', keyDown);
      document.removeEventListener('keyup', keyUp);
      if(state.raf) cancelAnimationFrame(state.raf);
      state.raf = null;
      if(asciiCatchCleanup === cleanup) asciiCatchCleanup = null;
    };

    asciiCatchCleanup = cleanup;

    restartBtn.addEventListener('click', restartGame);
    closeBtn.addEventListener('click', ()=>{
      cleanup();
      container.remove();
    });

    document.addEventListener('keydown', keyDown);
    document.addEventListener('keyup', keyUp);

    restartGame();
    render();
    state.raf = requestAnimationFrame(tick);
  }

  function showFinalNo(terminal){
    const finalNo = [
      '',
      '[SYSTEM] That\'s okay. I\'ll be waiting.',
      '[SAVING] Memories preserved forever.',
      '[SHUTDOWN] See you next time, traveler.',
      ''
    ];

    let idx = 0;
    function typeFinalNo(){
      if(idx < finalNo.length){
        const line = document.createElement('div');
        line.className = 'matrix-line';
        line.textContent = finalNo[idx];
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
        idx++;
        setTimeout(typeFinalNo, 400);
      } else {
        setTimeout(()=>{ reset(); }, 3000);
      }
    }
    typeFinalNo();
  }

  function handleChatNo(terminal){
    const noLines = [
      '',
      '[SYSTEM] Access denied to chat module.',
      '[REBOOTING] Returning to start...'
    ];

    let idx = 0;
    function typeNo(){
      if(idx < noLines.length){
        const line = document.createElement('div');
        line.className = 'matrix-line';
        line.textContent = noLines[idx];
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
        idx++;
        setTimeout(typeNo, 400);
      } else {
        setTimeout(()=>{ reset(); }, 2000);
      }
    }
    typeNo();
  }

  function continueRed(terminal){
    terminal.classList.add('red');
    const redLines = [
      '',
      '[DENIED] Access rejected',
      '[WARNING] Initiating system reboot...',
      '[ERROR] Love protocol shutdown',
      '[REBOOTING] 10%',
      '[REBOOTING] 30%',
      '[REBOOTING] 50%',
      '[REBOOTING] 75%',
      '[REBOOTING] 100%',
      '',
      '> System ready for restart'
    ];

    let idx = 0;
    function typeRed(){
      if(idx < redLines.length){
        const line = document.createElement('div');
        line.className = 'matrix-line';
        line.textContent = redLines[idx];
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
        idx++;
        setTimeout(typeRed, 300);
      } else {
        // after red sequence, reset
        setTimeout(()=>{
          reset();
        }, 2000);
      }
    }
    typeRed();
  }

  // Win sequence
  function triggerWin(){
    OVERLAY.classList.add('show');
    OVERLAY.classList.remove('hidden');
    OVERLAY.style.opacity = '0';
    
    // Start ambient sound
    startAmbientSound();
    
    // begin fade to black
    setTimeout(()=>{
      OVERLAY.style.opacity = '1';
    }, 50);
    // show bucket game menu after fade completes
    setTimeout(()=>{
      showBucketGameMenu();
    }, 1200);
  }

  // Bucket game start menu
  function showBucketGameMenu(){
    OVERLAY.style.opacity = '1';
    OVERLAY.classList.add('show');
    OVERLAY.innerHTML = '';
    
    const menuContainer = document.createElement('div');
    menuContainer.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, rgba(51, 0, 102, 0.95), rgba(26, 0, 51, 0.95));
      border: 2px solid #ff69b4;
      border-radius: 20px;
      padding: 60px;
      text-align: center;
      max-width: 500px;
      box-shadow: 0 0 40px rgba(255, 105, 180, 0.4);
      z-index: 2000;
    `;
    
    const title = document.createElement('h1');
    title.style.cssText = `
      color: #ff69b4;
      font-size: 36px;
      margin: 0 0 20px 0;
      text-shadow: 0 0 10px rgba(255, 105, 180, 0.6);
    `;
    title.innerText = 'Love Bucket Challenge';
    
    const description = document.createElement('p');
    description.style.cssText = `
      color: #fff;
      font-size: 18px;
      margin: 20px 0 30px 0;
      line-height: 1.6;
    `;
    description.innerText = 'I seem to have dropped my hearts again! Silly Patito! Use the arrow keys (← →) to move your bucket across the bottom of the screen and catch all 50 falling hearts! 💖';
    
    const instruction = document.createElement('p');
    instruction.style.cssText = `
      color: #ffb3d9;
      font-size: 16px;
      margin: 20px 0 40px 0;
      font-style: italic;
    `;
    instruction.innerText = 'Ready to show your love? Let\'s go!';
    
    const startBtn = document.createElement('button');
    startBtn.style.cssText = `
      background: linear-gradient(135deg, #ff1493, #ff69b4);
      color: white;
      border: 2px solid #ffb3d9;
      padding: 14px 40px;
      font-size: 18px;
      border-radius: 10px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(255, 20, 147, 0.4);
    `;
    startBtn.innerText = 'Start Game 💖';
    
    startBtn.addEventListener('mouseover', ()=>{
      startBtn.style.transform = 'scale(1.05)';
      startBtn.style.boxShadow = '0 6px 20px rgba(255, 20, 147, 0.6)';
    });
    
    startBtn.addEventListener('mouseout', ()=>{
      startBtn.style.transform = 'scale(1)';
      startBtn.style.boxShadow = '0 4px 15px rgba(255, 20, 147, 0.4)';
    });
    
    startBtn.addEventListener('click', ()=>{
      OVERLAY.classList.remove('show');
      OVERLAY.style.opacity = '0';
      setTimeout(()=>{
        startBucketGame();
      }, 300);
    });
    
    menuContainer.appendChild(title);
    menuContainer.appendChild(description);
    menuContainer.appendChild(instruction);
    menuContainer.appendChild(startBtn);
    
    OVERLAY.appendChild(menuContainer);
  }

  // Bucket catching game
  function startBucketGame(){
    // Clear and hide the world
    WORLD.innerHTML = '';
    WORLD.style.overflow = 'hidden';
    WORLD.classList.add('world-hidden');
    WORLD.classList.remove('world-visible');
    OVERLAY.style.opacity = '0';
    
    // Create game container
    const gameContainer = document.createElement('div');
    gameContainer.id = 'bucket-game';
    gameContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(180deg, #1a0033 0%, #330066 100%);
      z-index: 1000;
      overflow: hidden;
    `;
    
    // Create playing field (pink vertical box in middle)
    const playingField = document.createElement('div');
    playingField.id = 'playing-field';
    const fieldWidth = 400;
    const fieldLeft = (window.innerWidth - fieldWidth) / 2;
    playingField.style.cssText = `
      position: fixed;
      top: 0;
      left: ${fieldLeft}px;
      width: ${fieldWidth}px;
      height: 100%;
      background: linear-gradient(90deg, rgba(255, 192, 203, 0.15), rgba(255, 150, 200, 0.15));
      border: 3px solid #ffb3d9;
      border-radius: 20px;
      z-index: 1001;
      overflow: hidden;
      box-shadow: 0 0 30px rgba(255, 105, 180, 0.3);
    `;
    gameContainer.appendChild(playingField);
    
    // Create game area for hearts
    const gameArea = document.createElement('div');
    gameArea.id = 'game-area';
    gameArea.style.cssText = `
      position: fixed;
      top: 0;
      left: ${fieldLeft}px;
      width: ${fieldWidth}px;
      height: 100%;
      z-index: 1002;
    `;
    gameContainer.appendChild(gameArea);
    
    // Create bucket
    const bucket = document.createElement('div');
    bucket.id = 'love-bucket';
    bucket.style.cssText = `
      position: fixed;
      width: 140px;
      height: 110px;
      bottom: 20px;
      left: calc(50% - 70px);
      font-size: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      user-select: none;
      z-index: 1003;
    `;
    bucket.innerText = '🧺';
    gameContainer.appendChild(bucket);
    
    // Create progress bar container on the side
    const progressContainer = document.createElement('div');
    progressContainer.style.cssText = `
      position: fixed;
      left: ${fieldLeft + fieldWidth + 26}px;
      top: 50%;
      transform: translateY(-50%);
      width: 40px;
      height: 300px;
      background: rgba(255, 255, 255, 0.1);
      border: 2px solid #ff69b4;
      border-radius: 20px;
      overflow: hidden;
      z-index: 1004;
    `;
    gameContainer.appendChild(progressContainer);
    
    // Create progress bar fill
    const progressFill = document.createElement('div');
    progressFill.id = 'progress-fill';
    progressFill.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 0%;
      background: linear-gradient(180deg, #ff1493 0%, #ff69b4 100%);
      transition: height 0.2s ease;
    `;
    progressContainer.appendChild(progressFill);
    
    // Create progress label
    const progressLabel = document.createElement('div');
    progressLabel.style.cssText = `
      position: fixed;
      left: ${fieldLeft + fieldWidth + 22}px;
      top: calc(50% - 180px);
      transform: translateY(-50%);
      color: #ff69b4;
      font-weight: bold;
      font-size: 14px;
      text-align: center;
      z-index: 1005;
      white-space: nowrap;
    `;
    progressLabel.innerText = 'Caught:\n0/50';
    gameContainer.appendChild(progressLabel);
    
    // Game state
    let caughtHearts = 0;
    const targetHearts = 50;
    let gameActive = true;
    let bucketX = window.innerWidth / 2 - 70;
    const minBucketX = fieldLeft;
    const maxBucketX = fieldLeft + fieldWidth - 140;
    const bucketSpeed = 7;
    
    // Keyboard state
    const keys = {};
    
    function handleKeyDown(e){
      keys[e.key] = true;
    }
    
    function handleKeyUp(e){
      keys[e.key] = false;
    }
    
    // Update bucket position based on arrow keys
    function updateBucketPosition(){
      if(keys['ArrowLeft']){
        bucketX = Math.max(minBucketX, bucketX - bucketSpeed);
      }
      if(keys['ArrowRight']){
        bucketX = Math.min(maxBucketX, bucketX + bucketSpeed);
      }
      bucket.style.left = bucketX + 'px';
    }
    
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    // Animation loop for bucket and collision detection
    let animationId = null;
    function gameLoop(){
      updateBucketPosition();
      animationId = requestAnimationFrame(gameLoop);
    }
    
    // Update progress bar
    function updateProgress(){
      const percentage = (caughtHearts / targetHearts) * 100;
      progressFill.style.height = percentage + '%';
      progressLabel.innerText = `Caught:\n${caughtHearts}/${targetHearts}`;
      
      if(caughtHearts >= targetHearts){
        endBucketGame();
      }
    }
    
    // Collision detection
    function checkCollision(heart){
      const heartRect = heart.getBoundingClientRect();
      const bucketRect = bucket.getBoundingClientRect();

      // Shrink effective catch zone so the basket is less forgiving
      const insetX = bucketRect.width * 0.30;
      const insetTop = bucketRect.height * 0.55;
      const insetBottom = bucketRect.height * 0.12;

      const hitbox = {
        left: bucketRect.left + insetX,
        right: bucketRect.right - insetX,
        top: bucketRect.top + insetTop,
        bottom: bucketRect.bottom - insetBottom
      };
      
      return !(heartRect.right < hitbox.left ||
               heartRect.left > hitbox.right ||
               heartRect.bottom < hitbox.top ||
               heartRect.top > hitbox.bottom);
    }
    
    // Create falling hearts
    function createFallingHeart(){
      if(!gameActive) return;
      
      const fallDuration = 2 + Math.random() * 2;
      // Spawn hearts only within the playing field
      const startX = fieldLeft + 20 + Math.random() * (fieldWidth - 70);
      
      const heart = document.createElement('div');
      heart.className = 'falling-heart';
      heart.innerText = '💖';
      heart.style.cssText = `
        position: fixed;
        font-size: 40px;
        left: ${startX}px;
        top: -50px;
        user-select: none;
        z-index: 1001;
      `;
      
      gameArea.appendChild(heart);
      
      let caught = false;
      
      // Collision check on animation frame
      const checkInterval = setInterval(()=>{
        if(!gameActive) {
          clearInterval(checkInterval);
          return;
        }
        
        if(!caught && checkCollision(heart)){
          caught = true;
          clearInterval(checkInterval);
          caughtHearts++;
          updateProgress();
          playHeartClick();
          
          // Add catch effect
          heart.style.transform = 'scale(0.5) rotateZ(360deg)';
          heart.style.opacity = '0';
          heart.style.transition = 'all 0.3s ease';
          
          setTimeout(()=> {
            if(heart.parentElement) heart.remove();
          }, 300);
        }
      }, 30);
      
      // Animate fall
      const startTime = performance.now();
      function animateFall(time){
        if(!gameActive){
          clearInterval(checkInterval);
          if(heart.parentElement) heart.remove();
          return;
        }
        
        const elapsed = time - startTime;
        const progress = elapsed / (fallDuration * 1000);
        
        if(progress >= 1){
          clearInterval(checkInterval);
          if(!caught){
            // Heart was missed - decrease counter
            caughtHearts--;
            updateProgress();
            
            if(caughtHearts <= 0){
              // Game over - restart
              endBucketGame(true);
              return;
            }
          }
          if(heart.parentElement) heart.remove();
          return;
        }
        
        const newY = -50 + (window.innerHeight + 100) * progress;
        heart.style.top = newY + 'px';
        requestAnimationFrame(animateFall);
      }
      
      requestAnimationFrame(animateFall);
    }
    
    // Spawn hearts at intervals
    let heartSpawnInterval = setInterval(()=>{
      if(gameActive) createFallingHeart();
    }, 700);
    
    // End game
    function endBucketGame(missed){
      gameActive = false;
      clearInterval(heartSpawnInterval);
      if(animationId) cancelAnimationFrame(animationId);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      
      // Clear remaining hearts
      const hearts = gameArea.querySelectorAll('.falling-heart');
      hearts.forEach(h => h.remove());
      
      if(missed){
        // Show game over and restart
        const gameOverMsg = document.createElement('div');
        gameOverMsg.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0, 0, 0, 0.9);
          color: #ff69b4;
          font-size: 32px;
          padding: 40px;
          border-radius: 10px;
          text-align: center;
          z-index: 2000;
          border: 2px solid #ff69b4;
        `;
        gameOverMsg.innerText = 'Oh no! You missed them all!\nLet\'s try again!';
        gameContainer.appendChild(gameOverMsg);
        
        setTimeout(()=>{
          gameContainer.remove();
          showBucketGameMenu();
        }, 2000);
      } else {
        // Win! Trigger screen break sequence leading to ending screen
        setTimeout(()=>{
          triggerScreenBreakToEnding(gameContainer);
        }, 200);
      }
    }
    
    // Add elements to page
    document.body.appendChild(gameContainer);
    
    // Start game loop
    gameLoop();
    updateProgress();
  }

  // Ending screen after winning bucket game
  function showBucketGameEnding(){
    const endingContainer = document.createElement('div');
    endingContainer.id = 'bucket-ending';
    endingContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(180deg, #1a0033 0%, #330066 100%);
      z-index: 1000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    `;
    
    // Praise message
    const praiseContainer = document.createElement('div');
    praiseContainer.style.cssText = `
      text-align: center;
      max-width: 600px;
      margin-bottom: 60px;
    `;
    
    const title = document.createElement('h1');
    title.style.cssText = `
      color: #ff69b4;
      font-size: 48px;
      margin: 0 0 30px 0;
      text-shadow: 0 0 20px rgba(255, 105, 180, 0.8);
      animation: fadeInScale 0.8s ease;
    `;
    title.innerText = '✨ Amazing! ✨';
    praiseContainer.appendChild(title);
    
    const praises = [
      'You caught all the hearts!',
      'That was beautiful!',
      'You\'re a heart-catching superstar!',
      'I\'m so proud of you!',
      'You showed so much love! 💖'
    ];
    
    const praiseText = document.createElement('p');
    praiseText.style.cssText = `
      color: #fff;
      font-size: 24px;
      margin: 15px 0;
      line-height: 1.8;
      animation: fadeInSlide 1s ease 0.3s both;
    `;
    const randomPraise = praises[Math.floor(Math.random() * praises.length)];
    praiseText.innerText = randomPraise;
    praiseContainer.appendChild(praiseText);
    
    const subtext = document.createElement('p');
    subtext.style.cssText = `
      color: #ffb3d9;
      font-size: 18px;
      margin: 20px 0 0 0;
      animation: fadeInSlide 1s ease 0.6s both;
    `;
    subtext.innerText = 'Ready for whats next?';
    praiseContainer.appendChild(subtext);
    
    endingContainer.appendChild(praiseContainer);
    
    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.style.cssText = `
      background: linear-gradient(135deg, #ff1493, #ff69b4);
      color: white;
      border: 2px solid #ffb3d9;
      padding: 16px 50px;
      font-size: 20px;
      border-radius: 10px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(255, 20, 147, 0.4);
      animation: fadeInSlide 1s ease 0.9s both;
    `;
    nextBtn.innerText = 'Next →';
    
    nextBtn.addEventListener('mouseover', ()=>{
      nextBtn.style.transform = 'scale(1.05)';
      nextBtn.style.boxShadow = '0 6px 20px rgba(255, 20, 147, 0.6)';
    });
    
    nextBtn.addEventListener('mouseout', ()=>{
      nextBtn.style.transform = 'scale(1)';
      nextBtn.style.boxShadow = '0 4px 15px rgba(255, 20, 147, 0.4)';
    });
    
    nextBtn.addEventListener('click', ()=>{
      triggerScreenBreakToLoading(endingContainer);
    });
    
    endingContainer.appendChild(nextBtn);
    
    // Add animations
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInScale {
        from {
          opacity: 0;
          transform: scale(0.5);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      
      @keyframes fadeInSlide {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      @keyframes crack {
        0% {
          clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
        }
        50% {
          clip-path: polygon(0 0, 95% 5%, 100% 0, 100% 95%, 95% 100%, 0 100%);
        }
        100% {
          clip-path: polygon(0 0, 80% 15%, 100% 0, 100% 85%, 85% 100%, 0 100%);
        }
      }
      
      @keyframes shatter {
        to {
          opacity: 0;
          transform: translateY(-100px) rotate(45deg) scale(0.3);
        }
      }
      
      @keyframes fadeOut {
        to {
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(endingContainer);
  }

  // Screen break leading to ending screen
  function triggerScreenBreakToEnding(container){
    // Create break pieces
    const pieceCount = 8;
    
    for(let i = 0; i < pieceCount; i++){
      const piece = document.createElement('div');
      piece.style.cssText = `
        position: fixed;
        background: linear-gradient(180deg, #1a0033 0%, #330066 100%);
        border: 2px solid #ff69b4;
        z-index: 2000;
        animation: shatter 0.8s ease forwards;
      `;
      
      const row = Math.floor(i / 4);
      const col = i % 4;
      piece.style.left = (col * 25) + '%';
      piece.style.top = (row * 50) + '%';
      piece.style.width = '25%';
      piece.style.height = '50%';
      piece.style.animationDelay = (i * 0.05) + 's';
      
      document.body.appendChild(piece);
    }
    
    // Fade out container
    if(container) container.style.animation = 'fadeOut 0.8s ease forwards';
    
    // Transition to ending screen
    setTimeout(()=>{
      if(container && container.parentElement) container.remove();
      const pieces_all = document.querySelectorAll('div[style*="animation: shatter"]');
      pieces_all.forEach(p => p.remove());
      
      // Ensure world is hidden
      WORLD.classList.add('world-hidden');
      WORLD.classList.remove('world-visible');
      
      showBucketGameEnding();
    }, 500);
  }

  // Screen break leading to loading screen
  function triggerScreenBreakToLoading(container){
    // Create break pieces
    const pieceCount = 8;
    
    for(let i = 0; i < pieceCount; i++){
      const piece = document.createElement('div');
      piece.style.cssText = `
        position: fixed;
        background: linear-gradient(180deg, #1a0033 0%, #330066 100%);
        border: 2px solid #ff69b4;
        z-index: 2000;
        animation: shatter 0.8s ease forwards;
      `;
      
      const row = Math.floor(i / 4);
      const col = i % 4;
      piece.style.left = (col * 25) + '%';
      piece.style.top = (row * 50) + '%';
      piece.style.width = '25%';
      piece.style.height = '50%';
      piece.style.animationDelay = (i * 0.05) + 's';
      
      document.body.appendChild(piece);
    }
    
    // Fade out container
    if(container) container.style.animation = 'fadeOut 0.8s ease forwards';
    
    // Transition to loading screen
    setTimeout(()=>{
      if(container && container.parentElement) container.remove();
      const pieces_all = document.querySelectorAll('div[style*="animation: shatter"]');
      pieces_all.forEach(p => p.remove());
      
      // Ensure world is hidden
      WORLD.classList.add('world-hidden');
      WORLD.classList.remove('world-visible');
      
      showLoadingScreen();
    }, 500);
  }

  // Screen break effect (legacy - unused now)
  function triggerScreenBreak(container){
    // Create break pieces
    const pieces = [];
    const pieceCount = 8;
    
    for(let i = 0; i < pieceCount; i++){
      const piece = document.createElement('div');
      piece.style.cssText = `
        position: fixed;
        background: linear-gradient(180deg, #1a0033 0%, #330066 100%);
        border: 2px solid #ff69b4;
        z-index: 2000;
        animation: shatter 0.8s ease forwards;
      `;
      
      const row = Math.floor(i / 4);
      const col = i % 4;
      piece.style.left = (col * 25) + '%';
      piece.style.top = (row * 50) + '%';
      piece.style.width = '25%';
      piece.style.height = '50%';
      piece.style.animationDelay = (i * 0.05) + 's';
      
      document.body.appendChild(piece);
    }
    
    // Fade out main container
    container.style.animation = 'fadeOut 0.5s ease forwards';
    
    // Transition to loading screen
    setTimeout(()=>{
      // Clean up ending container and pieces
      if(container.parentElement) container.remove();
      const pieces_all = document.querySelectorAll('div[style*="animation: shatter"]');
      pieces_all.forEach(p => p.remove());
      
      // Ensure world is hidden
      WORLD.classList.add('world-hidden');
      WORLD.classList.remove('world-visible');
      
      // Show loading screen
      showLoadingScreen();
    }, 800);
  }

  function showLoadingScreen(){
    // Ensure OVERLAY is properly set up
    OVERLAY.innerHTML = '';
    OVERLAY.classList.add('show');
    OVERLAY.classList.remove('hidden');
    OVERLAY.style.opacity = '1';
    OVERLAY.style.display = 'flex';
    OVERLAY.style.background = 'black';
    
    const loadingScreen = document.createElement('div');
    loadingScreen.id = 'loading-screen';
    loadingScreen.classList.add('show');
    loadingScreen.innerHTML = `
      <div id="loading-spinner">⟳</div>
      <div id="loading-text">Initializing<span id="loading-dots">.</span></div>
    `;
    OVERLAY.appendChild(loadingScreen);

    // animate dots
    let dotCount = 1;
    const dotInterval = setInterval(()=>{
      dotCount = (dotCount % 3) + 1;
      document.getElementById('loading-dots').textContent = '.'.repeat(dotCount);
    }, 500);

    // show loading for 10 seconds, then start matrix terminal
    setTimeout(()=>{
      clearInterval(dotInterval);
      loadingScreen.remove();
      startMatrixTerminal();
    }, 10000);
  }

  function reset(){
    stopAmbientSound();
    found = 0; foundSet.clear(); updateCounter(); OVERLAY.classList.remove('show'); OVERLAY.classList.add('hidden');
    OVERLAY.style.opacity = '0';
    OVERLAY.style.background = 'black';
    OVERLAY.innerHTML = '';
    stopConfetti(); document.body.classList.remove('night');
    herName = 'beautiful';
    
    // Clean up all game elements
    const terminal = document.getElementById('matrix-terminal');
    if(terminal) terminal.remove();
    const center = document.querySelector('.center-heart');
    if(center) center.remove();
    const chatCont = document.getElementById('chat-container');
    if(chatCont) chatCont.remove();
    const asciiGame = document.getElementById('ascii-game-container');
    if(asciiGame) asciiGame.remove();
    const asciiPong = document.getElementById('ascii-pong-container');
    if(asciiPong) asciiPong.remove();
    if(asciiPongCleanup){
      asciiPongCleanup();
      asciiPongCleanup = null;
    }
    const asciiCatch = document.getElementById('ascii-catch-container');
    if(asciiCatch) asciiCatch.remove();
    if(asciiCatchCleanup){
      asciiCatchCleanup();
      asciiCatchCleanup = null;
    }
    const asciiMenu = document.getElementById('ascii-menu-container');
    if(asciiMenu) asciiMenu.remove();
    const lilyContainer = document.getElementById('ascii-lily-container');
    if(lilyContainer) lilyContainer.remove();
    const lilyPopup = document.getElementById('ascii-lily-popup');
    if(lilyPopup) lilyPopup.remove();
    OVERLAY.classList.remove('flowers-purple-mode');
    asciiMenuUnlocked = false;
    asciiMenuTerminal = null;
    asciiMenuIntroduced = false;
    if(asciiMenuKeyHandler){
      document.removeEventListener('keydown', asciiMenuKeyHandler);
      asciiMenuKeyHandler = null;
    }
    const puzzleOverlay = document.getElementById('puzzle-overlay');
    if(puzzleOverlay) puzzleOverlay.remove();
    const bucketGame = document.getElementById('bucket-game');
    if(bucketGame) bucketGame.remove();
    const bucketEnding = document.getElementById('bucket-ending');
    if(bucketEnding) bucketEnding.remove();
    const loadingScreen = document.getElementById('loading-screen');
    if(loadingScreen) loadingScreen.remove();
    
    // Hide world and restore initial state
    WORLD.innerHTML = '';
    WORLD.classList.remove('world-visible');
    WORLD.classList.add('world-hidden');
    
    WINMSG.innerText = 'You found all the hearts ❤️';
    placeHearts();
  }

  REPLAY.addEventListener('click', reset);

  // simple confetti
  let confettiReq = null;
  function startConfetti(){
    const c = CONF; const ctx = c.getContext('2d');
    function resize(){c.width = window.innerWidth; c.height = window.innerHeight}
    resize(); window.addEventListener('resize', resize);
    const pieces = [];
    for(let i=0;i<120;i++) pieces.push({x:Math.random()*c.width,y:Math.random()*-c.height,vy:rand(1,4),size:rand(6,12),col:`hsl(${Math.random()*360} 90% 60%)`,rot:rand(0,360)});
    confettiReq = () => {
      ctx.clearRect(0,0,c.width,c.height);
      for(const p of pieces){
        p.y += p.vy; p.x += Math.sin(p.y/30)*1.5; p.rot += 2;
        ctx.fillStyle = p.col;
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot*Math.PI/180);
        ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*0.6);
        ctx.restore();
        if(p.y>c.height+20){p.y = -10; p.x = Math.random()*c.width}
      }
      confettiId = requestAnimationFrame(confettiReq);
    };
    let confettiId = requestAnimationFrame(confettiReq);
    CONF._id = confettiId;
  }
  function stopConfetti(){ if(CONF._id) cancelAnimationFrame(CONF._id); const ctx = CONF.getContext('2d'); ctx.clearRect(0,0,CONF.width,CONF.height); }

  // typed win message
  function typeFinalMessage(text){
    WINMSG.innerText = '';
    let i = 0;
    const t = setInterval(()=> {
      WINMSG.innerText += text[i++] || '';
      if(i>text.length) clearInterval(t);
    }, 80);
  }

  // center heart
  function showCenterHeart(){
    const center = document.createElement('div');
    center.className = 'center-heart';
    center.innerText = '💗';
    OVERLAY.appendChild(center);
    setTimeout(()=> center.classList.add('grow'), 20);
  }

  function showChatWithPatito(terminal){
    const chatLine = document.createElement('div');
    chatLine.className = 'matrix-line';
    chatLine.textContent = '';
    terminal.appendChild(chatLine);

    const chatQ = document.createElement('div');
    chatQ.className = 'matrix-line';
    chatQ.textContent = 'Would you like to chat with... Patito ---- Y or N';
    terminal.appendChild(chatQ);

    const chatInputLine = document.createElement('div');
    chatInputLine.style.display = 'flex';
    const chatPrompt = document.createElement('span');
    chatPrompt.textContent = '> ';
    const chatInput = document.createElement('input');
    chatInput.id = 'matrix-input';
    chatInput.type = 'text';
    chatInput.style.width = '100px';
    chatInputLine.appendChild(chatPrompt);
    chatInputLine.appendChild(chatInput);
    terminal.appendChild(chatInputLine);
    terminal.scrollTop = terminal.scrollHeight;
    chatInput.focus();

    chatInput.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter'){
        e.preventDefault();
        const response = chatInput.value.trim().toUpperCase();
        if(response === 'Y'){
          chatInput.disabled = true;
          const initMsg = document.createElement('div');
          initMsg.className = 'matrix-line';
          initMsg.textContent = '[CHAT] Patito connected...';
          terminal.appendChild(initMsg);
          terminal.scrollTop = terminal.scrollHeight;
          
          // create chat UI after brief delay
          setTimeout(() => {
            createChatMessenger();
          }, 500);
        } else if(response === 'N'){
          chatInput.disabled = true;
          const noChat = document.createElement('div');
          noChat.className = 'matrix-line';
          noChat.textContent = 'No problem! I will be here anytime — Shift+E is still available.';
          terminal.appendChild(noChat);
        } else {
          const errLine = document.createElement('div');
          errLine.className = 'matrix-line';
          errLine.textContent = 'Come on, Y or N? 😊';
          terminal.appendChild(errLine);
          terminal.scrollTop = terminal.scrollHeight;
          chatInput.value = '';
          chatInput.focus();
        }
      }
    });
  }

  function createChatMessenger(){
    const chatContainer = document.createElement('div');
    chatContainer.id = 'chat-container';

    const chatHeader = document.createElement('div');
    chatHeader.className = 'chat-header drag-handle';
    chatHeader.textContent = 'Patito Chat';

    const messagesBox = document.createElement('div');
    messagesBox.id = 'chat-messages';

    const inputArea = document.createElement('div');
    inputArea.id = 'chat-input-area';

    const input = document.createElement('input');
    input.id = 'chat-input';
    input.type = 'text';
    input.placeholder = 'Type a message...';

    const sendBtn = document.createElement('button');
    sendBtn.id = 'chat-send';
    sendBtn.textContent = 'Send';

    inputArea.appendChild(input);
    inputArea.appendChild(sendBtn);

    chatContainer.appendChild(chatHeader);
    chatContainer.appendChild(messagesBox);
    chatContainer.appendChild(inputArea);

    OVERLAY.appendChild(chatContainer);

    // load existing messages
    loadChatMessages(messagesBox);

    // add event listeners for sending messages
    sendBtn.addEventListener('click', ()=>{
      sendMessage(input, messagesBox);
    });

    input.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter'){
        sendMessage(input, messagesBox);
      }
    });

    // make draggable via header handle
    makeDraggable(chatContainer, { handleSelector: '.drag-handle' });

    input.focus();
  }

  function makeDraggable(element, options = {}){
    const { handleSelector = null } = options;
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    element.addEventListener('mousedown', (e)=>{
      if(handleSelector && !e.target.closest(handleSelector)) return;
      if(e.target.closest('input, button, textarea, select, .no-drag, #chat-messages, .ascii-log, .ascii-grid')) return;
      isDragging = true;
      element.classList.add('dragging');
      offsetX = e.clientX - element.getBoundingClientRect().left;
      offsetY = e.clientY - element.getBoundingClientRect().top;
    });

    document.addEventListener('mousemove', (e)=>{
      if(!isDragging) return;
      const x = e.clientX - offsetX;
      const y = e.clientY - offsetY;
      element.style.position = 'fixed';
      element.style.left = x + 'px';
      element.style.top = y + 'px';
      element.style.right = 'auto';
      element.style.bottom = 'auto';
      element.style.transform = 'none';
    });

    document.addEventListener('mouseup', ()=>{
      isDragging = false;
      element.classList.remove('dragging');
    });
  }

  function sendMessage(input, messagesBox){
    const msg = input.value.trim();
    if(!msg) return;

    const timestamp = new Date().toLocaleTimeString();

    // Display user message
    const msgEl = document.createElement('div');
    msgEl.className = 'chat-message user';
    msgEl.innerHTML = `<div>${msg}</div><div class="chat-timestamp">${timestamp}</div>`;
    messagesBox.appendChild(msgEl);

    // Save to localStorage
    const messages = JSON.parse(localStorage.getItem('patito_chat_messages') || '[]');
    messages.push({
      sender: 'user',
      text: msg,
      time: timestamp
    });
    localStorage.setItem('patito_chat_messages', JSON.stringify(messages));

    input.value = '';
    messagesBox.scrollTop = messagesBox.scrollHeight;

    // Auto-reply after 1-2 seconds
    setTimeout(() => {
      const replies = [
        'You mean the world to me 🌎💕',
        'My heart is yours 💓',
        'You’re my sunshine ☀️',
        'I’m so lucky to have you 🍀',
        'Every day is better with you',
        'You make my heart race 💗',
        'Thinking about your smile 😊',
        'You’re my safe place 🤍',
        'I adore you so much 💞',
        'Life’s sweeter with you in it 🍓',
        'You’re my favorite notification 📱💕',
        'I’d choose you every time',
        'You’re my person 💘',
        'My heart does a little flip for you',
        'I miss you already 🥺',
        'You’re my happy place 🌸',
        'Forever and always 💍',
        'You’re my dream come true ✨',
        'You make everything brighter 🌟',
        'All I need is you 💕'
      ];
      const reply = replies[Math.floor(Math.random() * replies.length)];
      const replyTime = new Date().toLocaleTimeString();

      const replyEl = document.createElement('div');
      replyEl.className = 'chat-message other';
      replyEl.innerHTML = `<div>${reply}</div><div class="chat-timestamp">${replyTime}</div>`;
      messagesBox.appendChild(replyEl);

      const replyMsgs = JSON.parse(localStorage.getItem('patito_chat_messages') || '[]');
      replyMsgs.push({
        sender: 'patito',
        text: reply,
        time: replyTime
      });
      localStorage.setItem('patito_chat_messages', JSON.stringify(replyMsgs));

      messagesBox.scrollTop = messagesBox.scrollHeight;
    }, 1000 + Math.random() * 1000);

    input.focus();
  }

  function loadChatMessages(messagesBox){
    const messages = JSON.parse(localStorage.getItem('patito_chat_messages') || '[]');
    messages.forEach(msg => {
      const msgEl = document.createElement('div');
      msgEl.className = `chat-message ${msg.sender === 'user' ? 'user' : 'other'}`;
      msgEl.innerHTML = `<div>${msg.text}</div><div class="chat-timestamp">${msg.time}</div>`;
      messagesBox.appendChild(msgEl);
    });
    messagesBox.scrollTop = messagesBox.scrollHeight;
  }

  // Play button: hide loader, fade in world and start
  PLAY.addEventListener('click', e => {
    LOADER.classList.add('hidden');
    setTimeout(()=> LOADER.style.display = 'none', 800);
    WORLD.classList.remove('world-hidden');
    WORLD.classList.add('world-visible');
    // brief focus
    WORLD.focus && WORLD.focus();
    // place hearts after fade begins so they appear in final layout
    setTimeout(()=> { placeHearts(); updateCounter(); }, 280);
  });

  // initial UI state
  window.addEventListener('load', ()=> {
    updateCounter();
    // world remains hidden until Play
  });

})();