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
    "A secret hug is waiting.",
    "You're my favorite adventure.",
    "I love how you laugh.",
    "You're beautiful inside and out.",
    "Thank you for being you.",
    "Let's make more memories.",
    "I thought of you when I made this. 💖 And I think it would be really funny to watch you try and read all this text. So here is the entire alphabet, upper and lowercase. A B C D E F G H I J K L M N O P Q R S T U V W X Y Z a b c d e f g h i j k l m n o p q r s t u v w x y z :)"
  ];

  let found = 0;
  const foundSet = new Set();

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
    const h = document.createElement('h4'); h.innerText = 'Surprise';
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
    },200);
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
      'To my most wonderful person,',
      '',
      'These 8 hearts represent 8 reasons why you mean everything to me.',
      'But honestly, I could find 8,000 more.',
      '',
      'You are my adventure, my laugh, my dream come true.',
      'Every moment with you feels like breaking free from the ordinary,',
      'Finding magic in the simplest things.',
      '',
      'So I ask you now, with all my heart:',
      ''
    ];

    let idx = 0;
    function typeConfession(){
      if(idx < confession.length){
        const line = document.createElement('div');
        line.className = 'matrix-line';
        line.textContent = confession[idx];
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
        idx++;
        setTimeout(typeConfession, 300);
      } else {
        setTimeout(()=>{
          showFinalQuestion(terminal);
        }, 500);
      }
    }
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
        // after 15 seconds, show the bonus line
        setTimeout(()=>{
          const bonusLine = document.createElement('div');
          bonusLine.className = 'matrix-line';
          bonusLine.textContent = 'I love you more... mwahahahahahha ;)';
          terminal.appendChild(bonusLine);
          terminal.scrollTop = terminal.scrollHeight;
          
          // after bonus line, show chat question
          setTimeout(()=>{
            showChatWithPatito(terminal);
          }, 3000);
        }, 15000);
      }
    }
    typeFinalYes();
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
    // show loading screen after fade completes
    setTimeout(()=>{
      showLoadingScreen();
    }, 1200);
  }

  function showLoadingScreen(){
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
    stopConfetti(); document.body.classList.remove('night');
    herName = 'beautiful';
    const terminal = document.getElementById('matrix-terminal');
    if(terminal) terminal.remove();
    const center = document.querySelector('.center-heart');
    if(center) center.remove();
    const chatCont = document.getElementById('chat-container');
    if(chatCont) chatCont.remove();
    const puzzleOverlay = document.getElementById('puzzle-overlay');
    if(puzzleOverlay) puzzleOverlay.remove();
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
          noChat.textContent = 'No problem! Waiting for you anytime...';
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

    // make draggable
    makeDraggable(chatContainer);

    input.focus();
  }

  function makeDraggable(element){
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    element.addEventListener('mousedown', (e)=>{
      // only drag if clicking on empty space, not on input or button
      if(e.target.id === 'chat-input' || e.target.id === 'chat-send' || e.target.id === 'chat-messages') return;
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
        'That\'s sweet 💕',
        'I love you too 😊',
        'You make me happy',
        'Always thinking about you',
        'Can\'t wait to see you',
        'You\'re my favorite person',
        'Forever yours 💝'
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