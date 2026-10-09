import * as THREE from 'three';
import { store } from '../store/state.js';
import { showToastNotification } from './actionModals.js';
import { authService } from '../services/authService.js';

/**
 * AdminLoginScreen
 * ----------------
 * Cinematic full-screen 3D login experience.
 * Mounts into #admin-portal-container.
 * On success calls onSuccessCallback(). On close calls onCloseCallback().
 * SECURITY: No credentials pre-filled. Auth always enforced.
 */
export class AdminLoginScreen {
  constructor(containerElement, onSuccessCallback, onCloseCallback) {
    this.container = containerElement;
    this.onSuccess = onSuccessCallback;
    this.onClose = onCloseCallback;
    this._threeCleanup = null;
    this._passwordVisible = false;
    this._isLoading = false;
    this._boundKeydown = this._handleKeydown.bind(this);
  }

  mount() {
    this._renderHTML();
    this._initThreeScene();
    this._attachEvents();
    document.addEventListener('keydown', this._boundKeydown);
    document.body.style.overflow = 'hidden';
  }

  unmount() {
    if (this._threeCleanup) this._threeCleanup();
    document.removeEventListener('keydown', this._boundKeydown);
    document.body.style.overflow = '';
    this.container.innerHTML = '';
  }

  _handleKeydown(e) {
    if (e.key === 'Escape') this._closeScreen();
  }

  _renderHTML() {
    this.container.innerHTML = `
      <div class="aln-root" id="aln-root">
        <div class="aln-canvas-host" id="aln-canvas-host"></div>
        <div class="aln-overlay"></div>
        <button type="button" class="aln-close-btn" id="aln-close-btn" title="Return to public site" aria-label="Close admin portal">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div class="aln-brand-watermark">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="7.5" cy="15.5" r="5.5"/>
            <path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>
          </svg>
          <span>KEY TO KOCHI</span>
        </div>
        <div class="aln-panel-wrap">
          <div class="aln-panel" id="aln-panel">
            <div class="aln-panel-header">
              <div class="aln-key-emblem">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="7.5" cy="15.5" r="5.5"/>
                  <path d="m21 2-9.6 9.6"/>
                  <path d="m15.5 7.5 3 3L22 7l-3-3"/>
                </svg>
              </div>
              <h1 class="aln-title">Admin Portal Authentication</h1>
              <p class="aln-subtitle">KEY TO KOCHI &mdash; Secure Management Access</p>
            </div>
            <div class="aln-divider">
              <span class="aln-divider-line"></span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#d4af37"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <span class="aln-divider-line"></span>
            </div>
            <form id="aln-form" class="aln-form" novalidate autocomplete="off">
              <div class="aln-field-group" id="aln-email-group">
                <label class="aln-label" for="aln-email">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  Admin Email
                </label>
                <input type="email" id="aln-email" class="aln-input" placeholder="your@email.com" required autocomplete="username" spellcheck="false" />
                <span class="aln-field-error" id="aln-email-error"></span>
              </div>
              <div class="aln-field-group" id="aln-pass-group">
                <label class="aln-label" for="aln-pass">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Password
                </label>
                <div class="aln-pass-wrap">
                  <input type="password" id="aln-pass" class="aln-input" placeholder="Enter your password" required autocomplete="current-password" />
                  <button type="button" class="aln-toggle-pass" id="aln-toggle-pass" tabindex="0" aria-label="Toggle password visibility">
                    <svg class="eye-icon show-eye" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    <svg class="eye-icon hide-eye" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  </button>
                </div>
                <span class="aln-field-error" id="aln-pass-error"></span>
              </div>
              <div class="aln-forgot-row">
                <button type="button" class="aln-forgot-btn" id="aln-forgot-btn">Forgot password?</button>
              </div>
              <div class="aln-form-error" id="aln-form-error" style="display:none"></div>
              <button type="submit" class="aln-submit-btn" id="aln-submit-btn">
                <span class="aln-btn-text" id="aln-btn-text">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Sign In to Dashboard
                </span>
                <span class="aln-btn-loading" id="aln-btn-loading" style="display:none">
                  <svg class="aln-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  Verifying&hellip;
                </span>
              </button>
            </form>
            <p class="aln-panel-footer">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Secured connection &nbsp;&middot;&nbsp; Authorised personnel only
            </p>
          </div>
        </div>
      </div>
    `;
  }

  _initThreeScene() {
    const host = this.container.querySelector('#aln-canvas-host');
    if (!host) return;
    try {
      const tc = document.createElement('canvas');
      const gl = tc.getContext('webgl') || tc.getContext('experimental-webgl');
      if (!gl) return;
    } catch (e) { return; }

    const W = () => host.clientWidth || window.innerWidth;
    const H = () => host.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060810);
    scene.fog = new THREE.FogExp2(0x060810, 0.018);

    const camera = new THREE.PerspectiveCamera(52, W() / H(), 0.1, 500);
    camera.position.set(0, 14, 40);
    camera.lookAt(0, 4, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(W(), H());
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    host.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x0d1225, 1.4));
    const moonLight = new THREE.DirectionalLight(0x4a7fc1, 0.7);
    moonLight.position.set(20, 50, 30);
    moonLight.castShadow = true;
    scene.add(moonLight);
    const goldLight = new THREE.PointLight(0xd4af37, 3.5, 55);
    goldLight.position.set(-8, 10, 8);
    scene.add(goldLight);
    const goldLight2 = new THREE.PointLight(0xf59e0b, 2.8, 45);
    goldLight2.position.set(12, 8, -4);
    scene.add(goldLight2);
    const rearGlow = new THREE.PointLight(0x1e3a8a, 1.8, 80);
    rearGlow.position.set(0, 30, -30);
    scene.add(rearGlow);

    // Ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0x08101a, roughness: 0.9, metalness: 0.15 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const waterMat = new THREE.MeshStandardMaterial({ color: 0x071e2e, roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.82 });
    const waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(30, 200), waterMat);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.set(-32, 0.06, 0);
    scene.add(waterMesh);

    // Main Featured House
    const houseGroup = new THREE.Group();
    houseGroup.position.set(0, 0, -2);
    scene.add(houseGroup);

    const accentMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.2, metalness: 0.85 });
    const houseMat = new THREE.MeshStandardMaterial({ color: 0x1c2840, roughness: 0.35, metalness: 0.4 });

    const houseBody = new THREE.Mesh(new THREE.BoxGeometry(12, 7, 9), houseMat);
    houseBody.position.y = 3.5;
    houseBody.castShadow = true;
    houseBody.receiveShadow = true;
    houseGroup.add(houseBody);

    const houseAccent = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.35, 9.2), accentMat);
    houseAccent.position.y = 7.18;
    houseGroup.add(houseAccent);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(8, 4.5, 4),
      new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.6 })
    );
    roof.position.y = 9.5;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    houseGroup.add(roof);

    const ridgeCap = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), accentMat);
    ridgeCap.position.y = 11.8;
    houseGroup.add(ridgeCap);

    const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.2, 0.2), new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.5 }));
    door.position.set(0, 1.6, 4.55);
    houseGroup.add(door);

    const archGeo = new THREE.TorusGeometry(0.9, 0.12, 8, 16, Math.PI);
    const arch = new THREE.Mesh(archGeo, accentMat);
    arch.position.set(0, 3.2, 4.55);
    houseGroup.add(arch);

    const winLitMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const winFrameMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.7 });
    [[-3.8, 4.2, 4.55], [3.8, 4.2, 4.55], [-3.8, 2.2, 4.55], [3.8, 2.2, 4.55]].forEach(([wx, wy, wz]) => {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2, 1.8, 0.15), winFrameMat);
      frame.position.set(wx, wy, wz);
      houseGroup.add(frame);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 0.06), winLitMat);
      glass.position.set(wx, wy, wz + 0.06);
      houseGroup.add(glass);
    });

    const colMat = new THREE.MeshStandardMaterial({ color: 0xe8d5a3, roughness: 0.6 });
    [[-2.5, 0, 4.6], [2.5, 0, 4.6]].forEach(([cx, cy, cz]) => {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 4, 8), colMat);
      col.position.set(cx, 2, cz);
      houseGroup.add(col);
    });

    const porchCap = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 1.2), accentMat);
    porchCap.position.set(0, 4.15, 4.65);
    houseGroup.add(porchCap);

    // Cityscape towers
    const bm1 = new THREE.MeshStandardMaterial({ color: 0x141c2a, roughness: 0.5, metalness: 0.3 });
    const bm2 = new THREE.MeshStandardMaterial({ color: 0x1a2438, roughness: 0.4, metalness: 0.4 });
    const tAcc = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.15, metalness: 0.9 });
    const wSmall = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const wCool = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    [
      { x: -18, z: -18, w: 9, h: 30, d: 8, mat: bm1 },
      { x: 20, z: -22, w: 11, h: 40, d: 10, mat: bm2 },
      { x: 26, z: -4, w: 8, h: 20, d: 8, mat: bm1 },
      { x: -22, z: 18, w: 10, h: 26, d: 9, mat: bm2 },
      { x: 22, z: 20, w: 9, h: 32, d: 9, mat: bm1 },
      { x: -26, z: -32, w: 12, h: 44, d: 11, mat: bm2 },
      { x: 10, z: -38, w: 13, h: 48, d: 12, mat: bm1 },
    ].forEach(t => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(t.w, t.h, t.d), t.mat);
      mesh.position.set(t.x, t.h / 2, t.z);
      mesh.castShadow = true;
      scene.add(mesh);
      const crown = new THREE.Mesh(new THREE.BoxGeometry(t.w * 0.85, 0.9, t.d * 0.85), tAcc);
      crown.position.set(t.x, t.h + 0.45, t.z);
      scene.add(crown);
      const rows = Math.floor(t.h / 2.8);
      const cols = Math.floor(t.w / 2.4);
      for (let r = 2; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Math.random() > 0.42) {
            const wm = Math.random() > 0.35 ? wSmall : wCool;
            const w = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.1), wm);
            w.position.set(t.x - t.w / 2 + 1.2 + c * 2.2, r * 2.8, t.z + t.d / 2 + 0.04);
            scene.add(w);
          }
        }
      }
    });

    // Floating golden key
    const keyGroup = new THREE.Group();
    scene.add(keyGroup);
    keyGroup.position.set(-7, 8, 6);
    const keyMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.08, metalness: 1.0, emissive: 0xb8960f, emissiveIntensity: 0.3 });
    keyGroup.add(new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.22, 12, 40), keyMat));
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.6, 0.18), keyMat);
    shaft.position.set(0, -2.2, 0);
    keyGroup.add(shaft);
    [[0.14, -2.8], [0.14, -3.5], [0.14, -4.2]].forEach(([tx, ty]) => {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.18), keyMat);
      tooth.position.set(tx, ty, 0);
      keyGroup.add(tooth);
    });
    const keyLight = new THREE.PointLight(0xd4af37, 4.0, 20);
    keyLight.position.set(-7, 8, 6);
    scene.add(keyLight);

    // Palm trees
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2717, roughness: 0.9 });
    const frondMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.6 });
    [[-7, 5], [-9, 12], [7, 5], [9, 14], [-20, 2], [-23, 10], [24, 8]].forEach(([px, pz]) => {
      const g = new THREE.Group();
      g.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.35, 6, 6), trunkMat), { position: new THREE.Vector3(0, 3, 0) }));
      for (let fi = 0; fi < 6; fi++) {
        const ang = (fi / 6) * Math.PI * 2;
        const frond = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.2, 4), frondMat);
        frond.position.set(Math.cos(ang) * 1.1, 5.6, Math.sin(ang) * 1.1);
        frond.rotation.set(Math.PI / 2.5, ang, 0);
        g.add(frond);
      }
      g.position.set(px, 0, pz);
      scene.add(g);
    });

    // Particle field
    const pCount = 220;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount * 3; i += 3) {
      pPos[i] = (Math.random() - 0.5) * 100;
      pPos[i + 1] = 0.5 + Math.random() * 40;
      pPos[i + 2] = (Math.random() - 0.5) * 100;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xf59e0b, size: 0.38, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(particles);

    // Aurora rings
    for (let ai = 0; ai < 3; ai++) {
      const aurora = new THREE.Mesh(
        new THREE.TorusGeometry(18 + ai * 8, 0.4 - ai * 0.08, 4, 80),
        new THREE.MeshBasicMaterial({ color: ai === 0 ? 0xd4af37 : (ai === 1 ? 0x1e40af : 0x7c3aed), transparent: true, opacity: 0.04 + ai * 0.02, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
      );
      aurora.rotation.x = Math.PI / 2;
      aurora.position.y = 28 + ai * 6;
      scene.add(aurora);
    }

    // Animation loop
    let mouseX = 0, mouseY = 0;
    const startTime = performance.now();
    const onMouseMove = (e) => {
      mouseX = ((e.clientX / window.innerWidth) * 2 - 1) * 5;
      mouseY = (-(e.clientY / window.innerHeight) * 2 + 1) * 2.5;
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    const onResize = () => {
      camera.aspect = W() / H();
      camera.updateProjectionMatrix();
      renderer.setSize(W(), H());
    };
    window.addEventListener('resize', onResize);

    let rafId;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const t = (performance.now() - startTime) * 0.001;
      const targetX = Math.sin(t * 0.12) * 4 + mouseX * 0.6;
      const targetY = 14 + Math.cos(t * 0.09) * 1.5 + mouseY * 0.4;
      camera.position.x += (targetX - camera.position.x) * 0.025;
      camera.position.y += (targetY - camera.position.y) * 0.025;
      camera.lookAt(0, 4, 0);
      keyGroup.rotation.y = t * 0.6;
      keyGroup.rotation.z = Math.sin(t * 0.8) * 0.12;
      keyGroup.position.y = 8 + Math.sin(t * 1.1) * 0.6;
      keyLight.intensity = 3.5 + Math.sin(t * 2.2) * 1.2;
      keyLight.position.copy(keyGroup.position);
      goldLight.intensity = 3.0 + Math.sin(t * 1.4) * 0.8;
      goldLight2.intensity = 2.5 + Math.cos(t * 1.7) * 0.7;
      const pA = particles.geometry.attributes.position.array;
      for (let i = 1; i < pCount * 3; i += 3) pA[i] += Math.sin(t + i * 0.3) * 0.012;
      particles.geometry.attributes.position.needsUpdate = true;
      particles.rotation.y = t * 0.018;
      waterMat.opacity = 0.78 + Math.sin(t * 1.5) * 0.07;
      renderer.render(scene, camera);
    };
    animate();

    this._threeCleanup = () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      try { host.removeChild(renderer.domElement); } catch (_) {}
    };
  }

  _attachEvents() {
    const $ = id => this.container.querySelector(id);
    const closeBtn = $('#aln-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._closeScreen();
      });
      closeBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._closeScreen();
      }, { passive: false });
    }

    const passInput = $('#aln-pass');
    const toggleBtn = $('#aln-toggle-pass');
    const showEye = toggleBtn.querySelector('.show-eye');
    const hideEye = toggleBtn.querySelector('.hide-eye');
    toggleBtn.addEventListener('click', () => {
      this._passwordVisible = !this._passwordVisible;
      passInput.type = this._passwordVisible ? 'text' : 'password';
      showEye.style.display = this._passwordVisible ? 'none' : '';
      hideEye.style.display = this._passwordVisible ? '' : 'none';
    });

    $('#aln-forgot-btn').addEventListener('click', () => this._showForgotMessage());
    $('#aln-form').addEventListener('submit', e => { e.preventDefault(); this._handleSubmit(); });
  }

  _closeScreen() {
    this.unmount();
    document.body.style.overflow = '';
    if (this.onClose) this.onClose();
  }

  _showForgotMessage() {
    const el = this.container.querySelector('#aln-form-error');
    if (!el) return;
    el.style.display = 'flex';
    el.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1" fill="#f59e0b"/></svg> Contact your system administrator to reset your password.';
    el.className = 'aln-form-error aln-form-warn';
  }

  _clearErrors() {
    const $ = s => this.container.querySelector(s);
    [['#aln-email-error', 'text'], ['#aln-pass-error', 'text']].forEach(([sel, t]) => {
      const el = $(sel); if (el) el.textContent = '';
    });
    const fe = $('#aln-form-error');
    if (fe) { fe.style.display = 'none'; fe.className = 'aln-form-error'; }
    const eg = $('#aln-email-group'); if (eg) eg.classList.remove('has-error');
    const pg = $('#aln-pass-group'); if (pg) pg.classList.remove('has-error');
  }

  _setLoading(isLoading) {
    this._isLoading = isLoading;
    const btn = this.container.querySelector('#aln-submit-btn');
    const btnText = this.container.querySelector('#aln-btn-text');
    const btnLoading = this.container.querySelector('#aln-btn-loading');
    if (!btn) return;
    btn.disabled = isLoading;
    btnText.style.display = isLoading ? 'none' : 'flex';
    btnLoading.style.display = isLoading ? 'flex' : 'none';
    btn.classList.toggle('loading', isLoading);
  }

  _showFormError(message) {
    const el = this.container.querySelector('#aln-form-error');
    if (!el) return;
    el.style.display = 'flex';
    el.className = 'aln-form-error aln-form-err-active';
    el.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> ${message}`;
    const panel = this.container.querySelector('#aln-panel');
    if (panel) {
      panel.classList.remove('aln-shake');
      void panel.offsetWidth;
      panel.classList.add('aln-shake');
      setTimeout(() => panel.classList.remove('aln-shake'), 600);
    }
  }

  async _handleSubmit() {
    if (this._isLoading) return;
    this._clearErrors();
    const emailInput = this.container.querySelector('#aln-email');
    const passInput = this.container.querySelector('#aln-pass');
    const email = (emailInput ? emailInput.value : '').trim();
    const pass = (passInput ? passInput.value : '').trim();

    let valid = true;
    if (!email) {
      this.container.querySelector('#aln-email-group').classList.add('has-error');
      this.container.querySelector('#aln-email-error').textContent = 'Email address is required.';
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.container.querySelector('#aln-email-group').classList.add('has-error');
      this.container.querySelector('#aln-email-error').textContent = 'Enter a valid email address.';
      valid = false;
    }
    if (!pass) {
      this.container.querySelector('#aln-pass-group').classList.add('has-error');
      this.container.querySelector('#aln-pass-error').textContent = 'Password is required.';
      valid = false;
    }
    if (!valid) return;

    this._setLoading(true);
    try {
      const res = await authService.login(email, pass);
      if (res.ok && res.user && res.user.role === 'ADMIN') {
        const panel = this.container.querySelector('#aln-panel');
        if (panel) panel.classList.add('aln-success-flash');
        setTimeout(() => {
          this._setLoading(false);
          this.unmount();
          if (this.onSuccess) this.onSuccess(res.user);
        }, 380);
      } else {
        this._setLoading(false);
        if (passInput) passInput.value = '';
        this._showFormError(res.error || 'Invalid email or password.');
      }
    } catch (err) {
      this._setLoading(false);
      if (passInput) passInput.value = '';
      this._showFormError('Unable to connect to the authentication service. Please try again.');
    }
  }
}
