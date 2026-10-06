class InteractiveBee {
  constructor(options) {
    this.container = options.container;
    this.sprite = options.sprite;
    this.particlesContainer = options.particles;
    this.input = options.input;
    
    // Configurable tracking behavior
    this.moveXOnFocus = options.moveXOnFocus || 0;
    this.trackTyping = options.trackTyping !== undefined ? options.trackTyping : true;

    this.beeStates = {
      idle: `url('bee/happy.webp')`,
      find: `url('bee/find.webp')`,
      happy: `url('bee/happy.webp')`,
      sleep: `url('bee/sleep.webp')`,
      angry: `url('bee/angry.webp')`,
      fly: `url('bee/fly.webp')`,
      hi: `url('bee/hi.webp')`
    };

    this.isHovering = false;
    this.isFocused = false;
    this.idleTimeline = null;
    this.currentAction = null;
    
    // Performance & Mobile optimization
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.isMobile = window.innerWidth <= 768;

    this.initEvents();
    this.initIntersectionObserver();
    
    if (!this.prefersReducedMotion) {
      this.idle();
    } else {
      this.sprite.style.backgroundImage = this.beeStates.idle;
    }
  }

  // Performance: Pause animations when hidden
  initIntersectionObserver() {
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          if (!this.prefersReducedMotion && !this.isFocused) this.idle();
        } else {
          if (this.idleTimeline) this.idleTimeline.pause();
          if (this.blinkTween) this.blinkTween.pause();
          gsap.killTweensOf(this.sprite);
          gsap.killTweensOf(this.container);
        }
      });
    }, { threshold: 0.1 });
    observer.observe(this.container);
  }

  spawnSparkle(color = '#FFD700', size = 8, spread = 20) {
    if (!this.particlesContainer || this.prefersReducedMotion) return;
    const sparkle = document.createElement('div');
    sparkle.style.position = 'absolute';
    sparkle.style.width = size + 'px';
    sparkle.style.height = size + 'px';
    sparkle.style.background = color;
    sparkle.style.borderRadius = '50%';
    sparkle.style.pointerEvents = 'none';
    sparkle.style.boxShadow = `0 0 ${size}px ${size/4}px ${color.replace(')', ', 0.6)').replace('rgb', 'rgba')}`;
    sparkle.style.left = (Math.random() * 80 + 20) + 'px';
    sparkle.style.top = (Math.random() * 80 + 20) + 'px';
    
    this.particlesContainer.appendChild(sparkle);

    gsap.fromTo(sparkle, 
      { scale: 0, opacity: 1, rotation: 0 }, 
      { scale: Math.random() * 1.5 + 0.5, opacity: 0, rotation: 180, y: -spread, duration: 1, ease: 'power2.out', onComplete: () => sparkle.remove() }
    );
  }

  spawnSearchingParticle() {
    if (!this.particlesContainer || this.prefersReducedMotion) return;
    const dot = document.createElement('div');
    dot.style.position = 'absolute';
    dot.style.width = '3px';
    dot.style.height = '3px';
    dot.style.background = '#88c0d0'; // subtle blue
    dot.style.borderRadius = '50%';
    dot.style.pointerEvents = 'none';
    dot.style.boxShadow = '0 0 4px 1px rgba(136, 192, 208, 0.5)';
    dot.style.left = '30px'; // emanate from center roughly
    dot.style.top = '30px';
    
    this.particlesContainer.appendChild(dot);

    gsap.fromTo(dot,
      { scale: 0, opacity: 0.8 },
      { 
        x: (Math.random() - 0.5) * 60, 
        y: (Math.random() - 0.5) * 60,
        scale: Math.random() * 2,
        opacity: 0,
        duration: 1.5 + Math.random(),
        ease: 'power1.out',
        onComplete: () => dot.remove()
      }
    );
  }

  idle() {
    if (this.prefersReducedMotion) return;
    if (this.currentAction) this.currentAction.kill();
    if (this.blinkTween) this.blinkTween.kill();
    gsap.killTweensOf(this.container);
    gsap.killTweensOf(this.sprite);

    // Smooth transition back to idle, remove focus glow
    gsap.to(this.sprite, {
      scale: 1,
      rotation: 0,
      filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.15))',
      duration: 0.5,
      ease: 'power2.out',
      onComplete: () => {
        this.sprite.style.backgroundImage = this.beeStates.idle;
      }
    });

    this.idleTimeline = gsap.timeline({ repeat: -1, yoyo: true });
    
    // Calm floating
    this.idleTimeline.to(this.container, {
      y: -6,
      duration: 2.5,
      ease: 'sine.inOut'
    }, 0);
    
    gsap.to(this.sprite, {
      scaleY: 0.97, // Breathing effect
      duration: 1.5,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut'
    });

    // Natural blinking/sparkles
    this.blinkTween = gsap.to({}, {
      duration: 4,
      repeat: -1,
      onRepeat: () => {
        if (Math.random() > 0.7 && !this.isFocused) this.spawnSparkle('#FFD700', 4, 15);
      }
    });
  }

  focus() {
    this.isFocused = true;
    this.sprite.style.backgroundImage = this.beeStates.find;

    if (this.prefersReducedMotion) return;

    gsap.killTweensOf(this.container);
    gsap.killTweensOf(this.sprite);

    // CURIOUS state: Slight head tilt, interested expression, soft focus glow
    gsap.to(this.sprite, {
      rotation: 12, // Head tilt
      scale: 1.05,
      filter: 'drop-shadow(0 0 12px rgba(91,155,213,0.4))', // Soft glow around mascot
      duration: 0.65,
      ease: 'back.out(1.2)'
    });

    gsap.to(this.container, {
      x: this.moveXOnFocus !== 0 ? this.moveXOnFocus : 12, 
      y: -2,
      duration: 0.8,
      ease: 'expo.out'
    });
  }

  typing(textLength) {
    if (textLength === 0) {
      this.empty();
      return;
    }

    this.sprite.style.backgroundImage = this.beeStates.happy; // EXCITED
    
    if (this.prefersReducedMotion) return;

    if (this.trackTyping) {
      const offset = Math.min(textLength * 8, 300);
      gsap.to(this.container, {
        x: this.moveXOnFocus + offset,
        duration: 0.4,
        ease: 'power3.out'
      });
    }

    // EXCITED: Faster wing movement (simulated bounce), happy expression
    gsap.to(this.sprite, {
      y: -8,
      rotation: Math.random() > 0.5 ? 5 : -5,
      duration: 0.15,
      yoyo: true,
      repeat: 1,
      ease: 'power1.inOut'
    });

    if (textLength % 4 === 0) {
      this.spawnSparkle('#FFD700', 5, 20);
    }
  }

  searching() {
    this.sprite.style.backgroundImage = this.beeStates.find; // SEARCHING
    if (this.prefersReducedMotion) return;
    
    // Subtle motion trail / floating particles
    for(let i=0; i<8; i++) setTimeout(() => this.spawnSearchingParticle(), i*100);

    gsap.killTweensOf(this.sprite);
    
    // Determined expression, looking around
    gsap.to(this.sprite, {
      rotation: -10,
      scale: 1.1,
      duration: 0.6,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1
    });
  }

  success() {
    gsap.killTweensOf(this.sprite);
    this.sprite.style.backgroundImage = this.beeStates.happy;
    if (!this.prefersReducedMotion) {
      // SUCCESS: Celebration feeling, happy bounce
      gsap.to(this.sprite, { 
        scale: 1.15, 
        y: -15,
        rotation: 360,
        filter: 'drop-shadow(0 0 15px rgba(255,215,0,0.6))',
        duration: 0.8, 
        ease: 'back.out(1.4)' 
      });
      // Return to ground
      gsap.to(this.sprite, {
        scale: 1,
        y: 0,
        rotation: 0,
        filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.15))',
        delay: 0.8,
        duration: 0.5,
        ease: 'power3.out'
      });
      // Celebration particles
      const particleCount = this.isMobile ? 6 : 20;
      for(let i=0; i<particleCount; i++) setTimeout(() => this.spawnSparkle('#FFD700', Math.random()*6+4, 40), i*30);
    }
  }

  empty() {
    gsap.killTweensOf(this.sprite);
    this.sprite.style.backgroundImage = this.beeStates.sleep; // EMPTY: Friendly confusion
    if (!this.prefersReducedMotion) {
      // Head tilt, curious look
      gsap.to(this.sprite, { 
        rotation: -15, 
        scale: 0.95, 
        y: 2,
        duration: 0.5,
        ease: 'power2.out'
      });
    }
  }

  error() {
    gsap.killTweensOf(this.sprite);
    this.sprite.style.backgroundImage = this.beeStates.angry; // ERROR: Slight concern
    if (!this.prefersReducedMotion) {
      // Gentle shake, recovery
      gsap.to(this.sprite, { 
        scale: 1, 
        x: 4, 
        duration: 0.08, 
        yoyo: true, 
        repeat: 5,
        ease: 'sine.inOut'
      });
      // Recover
      gsap.to(this.sprite, {
        x: 0,
        delay: 0.48,
        duration: 0.3,
        ease: 'power2.out'
      });
    }
  }

  playHoverAnimation() {
    if (this.isFocused || this.prefersReducedMotion || this.isMobile) return;
    this.sprite.style.backgroundImage = this.beeStates.hi;
    
    gsap.to(this.sprite, {
      scale: 1.1,
      rotation: 8,
      duration: 0.3,
      ease: 'back.out(1.7)'
    });
    
    gsap.to(this.sprite, {
      scaleY: 1.05,
      duration: 0.05,
      yoyo: true,
      repeat: 5
    });

    this.spawnSparkle();
  }

  endHoverAnimation() {
    if (this.isFocused || this.prefersReducedMotion || this.isMobile) return;
    this.sprite.style.backgroundImage = this.beeStates.idle;
    gsap.to(this.sprite, {
      scale: 1,
      rotation: 0,
      duration: 0.3,
      ease: 'power2.out'
    });
  }

  playBarrelRoll() {
    if (this.prefersReducedMotion) return;
    this.sprite.style.backgroundImage = this.beeStates.fly;
    
    this.currentAction = gsap.timeline({ onComplete: () => {
      this.sprite.style.backgroundImage = this.isFocused ? this.beeStates.find : this.beeStates.idle;
    }});
    
    this.currentAction.to(this.sprite, {
      rotation: "+=360",
      scale: 0.85,
      duration: 0.7,
      ease: 'back.inOut(1.2)'
    }).to(this.sprite, {
      scale: 1,
      duration: 0.4,
      ease: 'power3.out'
    });

    for(let i=0; i<5; i++) setTimeout(() => this.spawnSparkle(), i*100);
  }

  initEvents() {
    if (!this.input) return;

    // High performance cursor tracking setup
    if (!this.prefersReducedMotion && !this.isMobile) {
      this.xTo = gsap.quickTo(this.sprite, "x", {duration: 0.4, ease: "power3"});
      this.yTo = gsap.quickTo(this.sprite, "y", {duration: 0.4, ease: "power3"});
      
      const searchBox = this.input.parentElement;
      if (searchBox) {
        searchBox.addEventListener('mousemove', (e) => {
          if (this.isFocused || this.prefersReducedMotion || this.currentAction) return;
          
          const rect = this.container.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          
          // Map distance to a constrained look radius (-4px to 4px)
          const maxLook = 4;
          const deltaX = Math.max(-1, Math.min(1, (e.clientX - centerX) / 100)) * maxLook;
          const deltaY = Math.max(-1, Math.min(1, (e.clientY - centerY) / 100)) * maxLook;
          
          this.xTo(deltaX);
          this.yTo(deltaY);
        });

        searchBox.addEventListener('mouseleave', () => {
          if (!this.isFocused && !this.prefersReducedMotion && this.xTo) {
            this.xTo(0);
            this.yTo(0);
          }
        });
      }
    }

    this.input.addEventListener('focus', () => {
      if (this.xTo) { this.xTo(0); this.yTo(0); }
      this.focus();
    });

    this.input.addEventListener('blur', () => {
      this.isFocused = false;
      if (this.prefersReducedMotion) {
        this.sprite.style.backgroundImage = this.beeStates.idle;
        return;
      }
      
      if (this.xTo) { this.xTo(0); this.yTo(0); }
      
      gsap.to(this.container, {
        x: 0,
        duration: 0.8,
        ease: 'expo.out',
        onComplete: () => this.idle()
      });
      
      gsap.to(this.sprite, {
        rotation: 0,
        scale: 1,
        duration: 0.6,
        ease: 'power3.out'
      });
    });

    this.input.addEventListener('input', (e) => {
      const textLength = e.target.value.length;
      this.typing(textLength);
      // Gaze towards input when typing
      if (!this.prefersReducedMotion && this.xTo && textLength > 0) {
        this.xTo(5); // Look slightly right
      }
    });

    if (this.container) {
      this.container.addEventListener('mouseenter', () => {
        this.isHovering = true;
        this.playHoverAnimation();
      });

      this.container.addEventListener('mouseleave', () => {
        this.isHovering = false;
        this.endHoverAnimation();
      });

      this.container.addEventListener('click', () => {
        if (this.xTo) { this.xTo(0); this.yTo(0); }
        this.playBarrelRoll();
      });
    }

    // Decoupled Business Logic Hooks (Custom Events)
    if (this.input) {
      this.input.addEventListener('bee:searching', () => this.searching());
      this.input.addEventListener('bee:success', () => this.success());
      this.input.addEventListener('bee:empty', () => this.empty());
      this.input.addEventListener('bee:error', () => this.error());
    }
  }

  // Cleanup method for detached nodes
  destroy() {
    if (this.idleTimeline) this.idleTimeline.kill();
    if (this.blinkTween) this.blinkTween.kill();
    if (this.currentAction) this.currentAction.kill();
    gsap.killTweensOf(this.sprite);
    gsap.killTweensOf(this.container);
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   UNIVERSAL SEARCH SYSTEM MANAGER
════════════════════════════════════════════════════════════════════════════ */

class BeeSearchSystem {
  constructor() {
    this.instances = new Map();
    this.init();
  }

  init() {
    if (typeof gsap === 'undefined') {
      console.warn("GSAP is not loaded. BeeSearchSystem disabled.");
      return;
    }

    // Initial scan
    this.scanForSearchInputs();

    // Observe future DOM changes for dynamically added search bars
    const observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      mutations.forEach(m => {
        if (m.addedNodes.length > 0) shouldScan = true;
        
        // Cleanup removed instances to prevent memory leaks
        m.removedNodes.forEach(node => {
          if (node.nodeType === 1) {
            const removedInputs = node.querySelectorAll ? Array.from(node.querySelectorAll('input.interactive-search, input[data-bee-search]')) : [];
            if (node.matches && (node.matches('input.interactive-search') || node.matches('input[data-bee-search]'))) removedInputs.push(node);
            
            removedInputs.forEach(input => {
              if (this.instances.has(input)) {
                this.instances.get(input).destroy();
                this.instances.delete(input);
              }
            });
          }
        });
      });
      if (shouldScan) this.scanForSearchInputs();
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  scanForSearchInputs() {
    const inputs = document.querySelectorAll('input.interactive-search, input[data-bee-search]');
    inputs.forEach(input => this.mountBee(input));
  }

  mountBee(input) {
    if (this.instances.has(input)) return; // Already mounted

    // Ensure parent has positioning context
    const parent = input.parentElement;
    const parentPos = window.getComputedStyle(parent).position;
    if (parentPos !== 'relative' && parentPos !== 'absolute' && parentPos !== 'fixed') {
      parent.style.position = 'relative';
    }

    // Prevent text overlap by dynamically injecting left padding
    const currentPadding = parseInt(window.getComputedStyle(input).paddingLeft, 10);
    if (currentPadding < 46) {
      input.style.paddingLeft = '50px';
    }
    
    // Inject the DOM structure BEFORE the input
    const beeWrapper = document.createElement('div');
    beeWrapper.className = 'main-bee-wrapper';
    beeWrapper.setAttribute('aria-hidden', 'true');
    beeWrapper.style.left = '10px';
    beeWrapper.style.top = '50%';
    beeWrapper.style.transform = 'translateY(-50%)';
    beeWrapper.style.marginTop = '0';

    const beeSprite = document.createElement('div');
    beeSprite.className = 'main-bee-sprite';
    // Use the optimized webp image natively
    beeSprite.style.backgroundImage = "url('bee/happy.webp')";
    
    const beeParticles = document.createElement('div');
    beeParticles.className = 'main-bee-particles';

    beeWrapper.appendChild(beeSprite);
    beeWrapper.appendChild(beeParticles);
    
    parent.insertBefore(beeWrapper, input);

    // Initialize InteractiveBee and bind to this input specifically
    const instance = new InteractiveBee({
      container: beeWrapper,
      sprite: beeSprite,
      particles: beeParticles,
      input: input,
      moveXOnFocus: 0, 
      trackTyping: false
    });

    this.instances.set(input, instance);
  }
}

// Auto-initialize system on boot
document.addEventListener("DOMContentLoaded", () => {
  window.beeSearchSystem = new BeeSearchSystem();
});
