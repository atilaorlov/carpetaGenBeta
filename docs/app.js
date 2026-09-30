'use strict';

const FIELDS_URL       = 'plantillas/fielder_attitude.json';
const AVISO_PDF_URL    = 'plantillas/aviso_privacidad.pdf';
const AVISO_FIELDS_URL = 'plantillas/aviso_privacidad.json';
const PORTA_PDF_URL    = 'plantillas/formato_porta.pdf';
const PORTA_FIELDS_URL = 'plantillas/porta.json';

/* ---------------- Credenciales de acceso ---------------- */
// Cada renglón es un par estrategia + clave. Agrega los que necesites.
const CREDENTIALS = [
  { estrategia: '10001147', clave: '350665' },
  { estrategia: '10000741', clave: '355882' },
  { estrategia: '10001147', clave: '354983' },
  { estrategia: '10001147', clave: '350658' },
  { estrategia: '10001147', clave: '350659' },
  { estrategia: '10000741', clave: '331943' },
  { estrategia: '10001147', clave: '352592' }, // Viv
  { estrategia: '10000741', clave: '354673' }, // Noe
  { estrategia: '10001147', clave: '355109' }, // Alan
  { estrategia: '10000741', clave: '355877' }, // Fran
  { estrategia: '10000741', clave: '353342' }, // Leah
  { estrategia: '10000741', clave: '354598' } // Sara
  
  
  
];

const STEPS = ['Solicitud', 'Cliente', 'Instalación', 'Domicilio', 'Documentos', 'Generar'];

const GROUPS = {
  0: [
    ['Tipo de cliente', 'radio', 'tipo_cliente', [['nuevo', 'Nuevo'], ['portado', 'Portabilidad'], ['existente', 'Existente']]],
    ['Tipo de servicio', 'radio', 'tipo_servicio', [['residencial', 'Residencial'], ['comercial', 'Comercial']]],
    ['Tecnología / producto', 'checks', 'tecnologia', [['ftth', 'FTTH'], ['wifi_negocio', 'WiFi negocio']]],
    ['Teléfono para contratar', 'tel', 'telefono_para_contratar'],
    ['Número a portar', 'tel', 'numero_a_portarr'],
    ['NIP de portabilidad', 'text', 'nip'],
    ['Fecha del NIP', 'text', 'fecha_nip'],
    ['Fecha de solicitud', 'date', 'fecha']
  ],
  1: [
    ['Nombre(s)', 'text', 'nombre_pila'],
    ['Apellido paterno', 'text', 'apellido_p'],
    ['Apellido materno', 'text', 'apellido_m'],
    ['RFC', 'text', 'rfc'],
    ['Fecha de nacimiento', 'text', 'fecha_nac'],
    ['Tipo de identificación', 'text', 'tipo_id'],
    ['Folio de identificación', 'text', 'folio_id'],
    ['Correo electrónico', 'email', 'email'],
    ['Teléfono de contacto', 'tel', 'telefono_contacto'],
    ['Teléfono del titular', 'tel', 'telefono_titular']
  ],
  2: [
    ['Nombre de quien recibe', 'text', 'nombre_recibe'],
    ['Horario de instalación', 'text', 'horario'],
    ['Observaciones', 'textarea', 'observaciones'],
    ['Forma de pago de instalación', 'radio', 'forma_pago', [
      ['un_solo_pago', 'Un solo pago'],
      ['pago_dif_inst', 'Pago diferido'],
      ['campo_25', 'Solo portabilidad sin gasto de instalación']
    ]],
    ['Observaciones del paquete', 'textarea', 'observaciones_paq']
  ],
  3: [
    ['Calle', 'text', 'calle'],
    ['Número exterior', 'text', 'num_ext'],
    ['Número interior', 'text', 'campo_31'],
    ['Colonia', 'text', 'colonia'],
    ['Ciudad', 'text', 'ciudad'],
    ['Estado', 'text', 'estado'],
    ['Municipio', 'text', 'municipio'],
    ['Código postal', 'text', 'codigo_postal'],
    ['Entre calle 1', 'text', 'entre_calle1'],
    ['Entre calle 2', 'text', 'entre_calle2'],
    ['Manzana', 'text', 'manzana'],
    ['Lote', 'text', 'lote'],
    ['Edificio', 'text', 'edificio'],
    ['Subnúmero', 'text', 'subnumero'],
    ['Giro comercial', 'text', 'giro_comercial'],
    ['Terminal', 'text', 'terminal'],
    ['Zona', 'text', 'zona'],
    ['Referencia del domicilio', 'textarea', 'alguna_referencia']
  ]
};

const DOCS = [
  ['recibo_pago',  'Estado de Cuenta'],
  ['ine_frente',   'INE frente'],
  ['ine_reverso',  'INE reverso'],
  ['fachada',      'Foto de fachada'],
  ['croquis',      'Croquis'],
  ['folio_imagen', 'Imagen del folio']
];

// Campos que se ocultan por defecto (se pueden mostrar con el botón "Mostrar opcionales")
const HIDDEN_BY_DEFAULT = new Set([
  'telefono_para_contratar',
  'rfc',
  'observaciones',
  'manzana',
  'lote',
  'edificio',
  'subnumero',
  'giro_comercial',
  'terminal',
  'zona',
  'alguna_referencia'
]);

const DEFAULT_DATA = {
  tipo_cliente:  'nuevo',
  tipo_servicio: 'residencial',
  nombre_recibe: 'TITULAR',
  horario:       'FIJO'
};

const state = {
  step: 0,
  data: { ...DEFAULT_DATA },
  files: {},
  fields: [],
  auth: null,
  expanded: {}    // ← NUEVA: controla qué pasos tienen los opcionales abiertos

};

const $ = s => document.querySelector(s);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* ---------------- IndexedDB ---------------- */

function db() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('carpeta-local-v1', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('draft');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function store(key, val) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction('draft', 'readwrite');
    t.objectStore('draft').put(val, key);
    t.oncomplete = () => { d.close(); res(); };
    t.onerror = () => rej(t.error);
  });
}

async function load(key) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction('draft');
    const r = t.objectStore('draft').get(key);
    r.onsuccess = () => { d.close(); res(r.result); };
    r.onerror = () => rej(r.error);
  });
}

let saving;
function save() {
  clearTimeout(saving);
  saving = setTimeout(async () => {
    try {
      await store('data', state.data);
      await store('files', state.files);
    } catch (e) {
      console.error(e);
    }
  }, 300);
}

/* ---------------- Login ---------------- */

function renderLogin(msg) {
  $('#steps').innerHTML = '';

  $('#back').classList.remove('hidden');
  $('#next').classList.remove('hidden');
  $('#back').disabled = true;
  $('#back').textContent = 'Atrás';
  $('#next').textContent = 'Entrar';
  $('#next').onclick = doLogin;

  $('#panel').innerHTML = `
    <h2>Acceso</h2>
    <p class="hint">Ingresa tu estrategia y clave de promotor para comenzar.</p>
    <div class="field">
      <label for="login_estrategia">Estrategia</label>
      <input id="login_estrategia" type="text" inputmode="numeric" autocomplete="off" autofocus>
    </div>
    <div class="field">
      <label for="login_clave">Clave del promotor</label>
      <input id="login_clave" type="text" inputmode="numeric" autocomplete="off">
    </div>
    ${msg ? `<div class="notice error">${esc(msg)}</div>` : ''}
  `;

  $('#login_clave').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); doLogin(); }
  });
  $('#login_estrategia').focus();
}

async function doLogin() {
  const est = $('#login_estrategia').value.trim();
  const cla = $('#login_clave').value.trim();
  const match = CREDENTIALS.find(c => c.estrategia === est && c.clave === cla);

  if (!match) {
    renderLogin('Estrategia o clave incorrecta.');
    return;
  }

  state.auth = { estrategia: match.estrategia, clave: match.clave };
  state.data.estrategia     = match.estrategia;
  state.data.clave_promotor = match.clave;

  await store('auth', state.auth);
  await store('data', state.data);

  state.step = 0;
  render();
  window.scrollTo(0, 0);
}

async function doLogout() {
  if (!confirm('¿Cerrar sesión? El borrador actual se conserva.')) return;
  state.auth = null;
  await store('auth', null);
  state.step = 0;
  renderLogin();
  window.scrollTo(0, 0);
}

/* ---------------- Render del formulario ---------------- */

function field([label, type, key, opts]) {
  const v = state.data[key] ?? '';

  if (type === 'radio' || type === 'checks') {
    return `<div class="field"><label>${esc(label)}</label><div class="choice">${
      opts.map(([val, text]) =>
        `<label><input type="${type === 'radio' ? 'radio' : 'checkbox'}" ` +
        `name="${esc(key)}" value="${esc(val)}" ` +
        `${type === 'radio'
          ? (v === val ? 'checked' : '')
          : (state.data[val] === true ? 'checked' : '')
        }>${esc(text)}</label>`
      ).join('')
    }</div></div>`;
  }

  const attrs =
    type === 'tel' ? 'inputmode="numeric" maxlength="10"' :
    key === 'nip' ? 'inputmode="numeric" maxlength="4"' :
    key === 'codigo_postal' ? 'inputmode="numeric" maxlength="5"' :
    '';

  return `<div class="field"><label for="${esc(key)}">${esc(label)}</label>${
    type === 'textarea'
      ? `<textarea id="${esc(key)}" name="${esc(key)}">${esc(v)}</textarea>`
      : `<input id="${esc(key)}" name="${esc(key)}" type="${type}" ${attrs} value="${esc(v)}">`
  }</div>`;
}

function docField(key, label) {
  const f = state.files[key];
  return `<div class="doc">` +
    `<label for="doc_${key}">${esc(label)} · opcional</label>` +
    `<input type="file" id="doc_${key}" data-file="${key}" accept="image/*">` +
    `<small>${f ? esc(f.name) + ' · guardada localmente' : 'Sin imagen seleccionada'}</small>` +
    `${f ? `<button class="secondary" type="button" data-remove="${key}">Quitar imagen</button>` : ''}` +
    `</div>`;
}

function render() {
  $('#steps').innerHTML = STEPS.map((_, i) =>
    `<span class="${i <= state.step ? 'active' : ''}" title="${STEPS[i]}"></span>`
  ).join('');

  let html = `<h2>${STEPS[state.step]}</h2>`;

  if (state.step <= 3) {
    const items = GROUPS[state.step].filter(f =>
      !(state.step === 0 &&
        ['numero_a_portarr', 'nip', 'fecha_nip'].includes(f[2]) &&
        state.data.tipo_cliente !== 'portado')
    );

    const visibles = items.filter(f => !HIDDEN_BY_DEFAULT.has(f[2]));
    const ocultos  = items.filter(f =>  HIDDEN_BY_DEFAULT.has(f[2]));

    html += visibles.map(field).join('');

    if (ocultos.length) {
      const expanded = !!state.expanded?.[state.step];
      if (expanded) {
        html += ocultos.map(field).join('');
        html += `<button type="button" class="secondary wide" id="toggle-more">Ocultar campos opcionales</button>`;
      } else {
        html += `<button type="button" class="secondary wide" id="toggle-more">Mostrar campos opcionales (${ocultos.length})</button>`;
      }
    }
  }

  if (state.step === 4) {
    html += '<p class="hint">Adjunta las imágenes disponibles. El folio se agrega únicamente después de validar.</p>';
    html += DOCS
      .filter(d => d[0] !== 'folio_imagen')
      .map(([key, label]) => docField(key, label))
      .join('');
  }

  if (state.step === 5) {
    html +=
      `<div class="box"><div class="summary">` +
        `<span>Cliente</span><span>${esc(formatValue('nombre_apellido') || 'Sin capturar')}</span>` +
        `<span>Solicitud</span><span>${
          state.data.tipo_cliente === 'portado' ? 'Portabilidad'
          : state.data.tipo_cliente === 'existente' ? 'Existente'
          : 'Nuevo'
        }</span>` +
        `<span>Documentos</span><span>${
          Object.keys(state.files).filter(k => k !== 'folio_imagen').length
        }</span>` +
      `</div></div>`;

    html += '<h3>1. Enviar a validación</h3>' +
            '<p class="hint">Genera la solicitud sin folio SIAC ni imagen de folio.</p>' +
            '<button class="wide" type="button" id="validation">Generar validación (PDF)</button>';

    html += '<h3>2. Completar carpeta validada</h3>' +
            '<div class="field"><label for="folio_siac">Folio SIAC</label>' +
            `<input id="folio_siac" name="folio_siac" value="${esc(state.data.folio_siac || '')}" placeholder="Captura el folio recibido"></div>` +
            docField('folio_imagen', 'Imagen del folio') +
            '<button class="wide" type="button" id="final">Generar carpeta final (PDF)</button>';

    html += '<button class="secondary wide" type="button" id="reset">Nueva solicitud (borrar borrador local)</button>';
    html += '<button class="secondary wide" type="button" id="logout">Cerrar sesión</button>';
  }

  $('#panel').innerHTML = html;

  $('#back').disabled = state.step === 0;
  $('#next').classList.toggle('hidden', state.step === 5);
  $('#back').textContent = state.step === 5 ? 'Volver' : 'Atrás';
  $('#next').textContent = 'Continuar';
  $('#next').onclick = () => {
    state.step = Math.min(5, state.step + 1);
    render();
    window.scrollTo(0, 0);
  };
}

/* ---------------- Eventos ---------------- */

$('#panel').addEventListener('input', e => {
  const t = e.target;
  if (!t.name) return;
  if (t.type === 'checkbox') state.data[t.value] = t.checked;
  else state.data[t.name] = t.value;
  save();
});

$('#panel').addEventListener('change', async e => {
  const t = e.target;
  if (t.dataset.file) {
    if (t.files?.[0]) {
      const f = t.files[0];
      if (!f.type.startsWith('image/')) { alert('Selecciona una imagen.'); return; }
      state.files[t.dataset.file] = f;
      save();
      render();
    }
    return;
  }
  if (t.name) {
    if (t.type === 'checkbox') state.data[t.value] = t.checked;
    else state.data[t.name] = t.value;
    save();
    if (t.name === 'tipo_cliente') render();
  }
});

$('#panel').addEventListener('click', async e => {
  const t = e.target;

  if (t.dataset.remove) {
    delete state.files[t.dataset.remove];
    save();
    render();
    return;
  }

  if (t.id === 'toggle-more') {
    state.expanded = state.expanded || {};
    state.expanded[state.step] = !state.expanded[state.step];
    render();
    return;
  }

  if (t.id === 'validation') { await generate(false); return; }
  if (t.id === 'final')      { await generate(true);  return; }
  if (t.id === 'logout')     { await doLogout();      return; }

  if (t.id === 'reset' &&
      confirm('¿Borrar los datos y documentos de esta solicitud en este navegador?')) {
    
    state.data  = { ...DEFAULT_DATA };
    state.data.estrategia     = state.auth?.estrategia     || '';
    state.data.clave_promotor = state.auth?.clave          || '';
    state.files = {};
    state.step  = 0;
    state.expanded = {};   // ← NUEVA
    await store('data', state.data);
    await store('files', state.files);
    render();
  }
});

$('#back').onclick = () => {
  state.step = Math.max(0, state.step - 1);
  render();
  window.scrollTo(0, 0);
};

$('#home').onclick = () => {
  if (!state.auth) return;
  if (state.step === 0) return;
  state.step = 0;
  render();
  window.scrollTo(0, 0);
};

/* ---------------- Formateo de valores ---------------- */

function formatValue(name) {
  const d = state.data;

  /* --- Fielder --- */
  if (name === 'cliente_nuevo')     return d.tipo_cliente === 'nuevo'     ? 'X' : '';
  if (name === 'cliente_portado')   return d.tipo_cliente === 'portado'   ? 'X' : '';
  if (name === 'cliente_existente') return d.tipo_cliente === 'existente' ? 'X' : '';
  if (name === 'residencial' || name === 'comercial') return d.tipo_servicio === name ? 'X' : '';
  if (['ftth', 'wifi_negocio'].includes(name))        return d[name] ? 'X' : '';
  if (['un_solo_pago', 'pago_dif_inst', 'campo_25'].includes(name))
    return d.forma_pago === name ? 'X' : '';

  // Nombre compuesto (fielder + aviso)
  if (name === 'nombre_apellido') {
    return [d.nombre_pila, d.apellido_p, d.apellido_m]
      .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }
  if (name === 'nombre_del_solicitante') return formatValue('nombre_apellido');

  if (name === 'fecha')
    return d.fecha ? d.fecha.split('-').reverse().join('/') : '';
  if (name === 'fecha_nac')
    return d.fecha_nac || '';

  /* --- Portabilidad --- */
  if (name === 'p_nombre')     return d.nombre_pila || '';
  if (name === 'p_apellido_p') return d.apellido_p || '';
  if (name === 'p_apellido_m') return d.apellido_m || '';
  if (name === 'p_tel')        return d.numero_a_portarr || '';
  if (name === 'p_nip')        return d.nip || '';
  if (name === 'p_fecha') {
    if (!d.fecha) return '';
    const [y, m, dd] = d.fecha.split('-');
    return y.slice(2) + m + dd;
  }

  return d[name] ?? '';
}

/* ---------------- Estilo de las "X" ---------------- */
const MARK_STYLE = {
  default: { scale: 1.00, dx: 0, dy: 0 },
  campo_25: { scale: 1, dx: 0, dy: 5 },
  cliente_nuevo:     { scale: 1.0, dx: -8, dy: 9 },
  cliente_portado:   { scale: 1.0, dx: -7, dy: 9 },
  cliente_existente: { scale: 1.0, dx: -8, dy: 9 },
  residencial:       { scale: 1.0, dx: -8, dy: 9 },
  comercial:         { scale: 1.0, dx: -8, dy: 9 },
  ftth:              { scale: 1.0, dx: -5, dy: 8 },
  wifi_negocio:      { scale: 1.0, dx: -6, dy: 9 },
  un_solo_pago:      { scale: 1.0, dx: -6, dy: 10 },
  pago_dif_inst:     { scale: 1.0, dx: -5, dy: 10 }
};

async function prependImagePage(mainPdf, file) {
  const tmpPdf = await PDFLib.PDFDocument.create();
  const bytes  = await file.arrayBuffer();
  let img;

  if (file.type === 'image/png') {
    img = await tmpPdf.embedPng(bytes);
  } else if (file.type === 'image/jpeg') {
    img = await tmpPdf.embedJpg(bytes);
  } else {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width  = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    const jpg = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85));
    img = await tmpPdf.embedJpg(await jpg.arrayBuffer());
    bitmap.close();
  }

  const page = tmpPdf.addPage([595.28, 841.89]);
  const maxW = page.getWidth()  - 48;
  const maxH = page.getHeight() - 48;
  const scale = Math.min(maxW / img.width, maxH / img.height);
  const w = img.width  * scale;
  const h = img.height * scale;

  page.drawImage(img, {
    x: (page.getWidth()  - w) / 2,
    y: (page.getHeight() - h) / 2,
    width: w,
    height: h
  });

  const [copied] = await mainPdf.copyPages(tmpPdf, [0]);
  mainPdf.insertPage(0, copied);   // ← al inicio del PDF
}


/* ---------------- Dibujo sobre el PDF ---------------- */

function drawField(page, font, f, text) {
  const pageW = page.getWidth();
  const pageH = page.getHeight();

  const x = f.x * pageW;
  const w = f.width * pageW;
  const h = f.height * pageH;
  const top = pageH - f.y * pageH;

  const raw = String(text ?? '');
  if (!raw.trim()) return;

  const ink = { color: PDFLib.rgb(0, 0, 0) };
  let size = f.font_size || 15;

  /* ---------- Multilínea ---------- */
  if (f.type === 'multiline') {
    const safe = raw.replace(/[^\x20-\x7E\xA0-\xFF\r\n]/g, '');
    const lines = [];

    for (const rawLine of safe.split(/\r?\n/)) {
      const paragraph = rawLine.replace(/\s+$/, '');
      if (!paragraph.trim()) { lines.push(''); continue; }

      if (font.widthOfTextAtSize(paragraph, size) <= w) {
        lines.push(paragraph);
        continue;
      }

      let line = '';
      for (const word of paragraph.split(/\s+/)) {
        const test = line ? line + ' ' + word : word;
        if (font.widthOfTextAtSize(test, size) > w && line) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
    }

    while (lines.length && !lines[lines.length - 1]) lines.pop();
    if (!lines.length) return;

    while (lines.length * size * 1.12 > h && size > 6) size -= 0.5;

    lines.forEach((ln, i) => {
      if (!ln) return;
      page.drawText(ln, {
        x,
        y: top - size * (i + 1) * 1.12 + size * 0.45,
        size,
        ...ink
      });
    });
    return;
  }

  /* ---------- Una sola línea: sanitizar ---------- */
  let clean = raw.replace(/\s+/g, ' ').trim();
  clean = clean.replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
  if (!clean) return;

  /* ---------- COMB: un carácter por cuadrito ---------- */
  if (f.type === 'comb' && f.max_chars > 0) {
    const chars = clean.replace(/\s+/g, '').slice(0, f.max_chars).split('');
    const cellW = w / f.max_chars;

    while (size > 5 && chars.some(ch =>
      font.widthOfTextAtSize(ch, size) > cellW * 0.85)) {
      size -= 0.5;
    }

    const baselineY = top - h + (h - size) / 2 + size * 0.78;

    chars.forEach((ch, i) => {
      const cw = font.widthOfTextAtSize(ch, size);
      const cx = x + i * cellW + (cellW - cw) / 2;
      page.drawText(ch, {
        x: cx,
        y: baselineY,
        size,
        ...ink
      });
    });
    return;
  }

  /* ---------- Texto normal ---------- */
  while (font.widthOfTextAtSize(clean, size) > w && size > 5) size -= 0.5;

  const isMark = clean.length === 1 && /[Xx]/.test(clean);

  if (isMark) {
    const style = MARK_STYLE[f.name] || MARK_STYLE.default;
    const pad = 0.15;
    const usableW = w * (1 - 2 * pad);
    const usableH = h * (1 - 2 * pad);
    const s = Math.min(usableW, usableH) * style.scale;

    const cx = x + w / 2 + style.dx;
    const cy = (top - h / 2) + style.dy;

    const x0 = cx - s / 2, x1 = cx + s / 2;
    const y0 = cy - s / 2, y1 = cy + s / 2;

    const thickness = Math.max(1.0, Math.min(s * 0.16, 5));

    page.drawLine({ start: { x: x0, y: y0 }, end: { x: x1, y: y1 }, thickness, color: ink.color });
    page.drawLine({ start: { x: x0, y: y1 }, end: { x: x1, y: y0 }, thickness, color: ink.color });
    return;
  }

  const sw = font.widthOfTextAtSize(clean, size);
  const dx = f.align === 'center' ? (w - sw) / 2
           : f.align === 'right'  ? w - sw
           : 0;

  page.drawText(clean, {
    x: x + Math.max(0, dx),
    y: top - h + (h - size) / 2 + size * 0.78,
    size,
    ...ink
  });
}

/* ---------------- Imágenes ---------------- */

async function appendImage(pdf, file) {
  const bytes = await file.arrayBuffer();
  let img;

  if (file.type === 'image/png') {
    img = await pdf.embedPng(bytes);
  } else if (file.type === 'image/jpeg') {
    img = await pdf.embedJpg(bytes);
  } else {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width  = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    const jpg = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85));
    img = await pdf.embedJpg(await jpg.arrayBuffer());
    bitmap.close();
  }

  const page = pdf.addPage([595.28, 841.89]);
  const maxW = page.getWidth()  - 48;
  const maxH = page.getHeight() - 48;
  const scale = Math.min(maxW / img.width, maxH / img.height);
  const w = img.width  * scale;
  const h = img.height * scale;

  page.drawImage(img, {
    x: (page.getWidth()  - w) / 2,
    y: (page.getHeight() - h) / 2,
    width: w,
    height: h
  });
}

/* ---------------- Plantillas anexas (aviso / porta) ---------------- */

async function appendTemplatePage(mainPdf, templateUrl, fieldsUrl) {
  const [pdfResp, jsonResp] = await Promise.all([
    fetch(templateUrl),
    fetch(fieldsUrl)
  ]);
  if (!pdfResp.ok)  throw Error(`No se encontró ${templateUrl}`);
  if (!jsonResp.ok) throw Error(`No se encontró ${fieldsUrl}`);

  const tpl    = await PDFLib.PDFDocument.load(await pdfResp.arrayBuffer());
  const fields = (await jsonResp.json()).fields || [];

  // 1) Copiamos la página al PDF principal PRIMERO
  const [copied] = await mainPdf.copyPages(tpl, [0]);
  mainPdf.addPage(copied);

  // 2) Embeber la fuente en el documento PRINCIPAL
  const mainFont = await mainPdf.embedFont(PDFLib.StandardFonts.Helvetica);

  // 3) Dibujar sobre la página YA copiada
  for (const f of fields) {
    const text = String(formatValue(f.name));
    drawField(copied, mainFont, f, text);
  }
}

/* ---------------- Generación del PDF ---------------- */

async function generate(final) {
  const btn = $('#' + (final ? 'final' : 'validation'));

  if (!window.PDFLib) {
    alert('No se cargó la librería PDF. Comprueba tu conexión a Internet.');
    return;
  }
  if (final && (!String(state.data.folio_siac || '').trim() || !state.files.folio_imagen)) {
    alert('Para generar la carpeta final, captura el folio SIAC y adjunta su imagen.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Generando PDF…';

  try {
    await store('data', state.data);
    await store('files', state.files);

    // 1) FIELDER
    const resp = await fetch('plantillas/fielder_attitude.pdf');
    if (!resp.ok) throw Error('No se encontró la plantilla Fielder.');

    const pdf  = await PDFLib.PDFDocument.load(await resp.arrayBuffer());
    const page = pdf.getPage(0);
    const font = await pdf.embedFont(PDFLib.StandardFonts.Helvetica);

    for (const f of state.fields) {
      if (f.name === 'folio_siac' && !final) continue;
      if (['numero_a_portarr', 'nip', 'fecha_nip'].includes(f.name)) continue;
      const text = String(formatValue(f.name));
      drawField(page, font, f, text);
    }

    // 2) AVISO DE PRIVACIDAD (siempre)
    await appendTemplatePage(pdf, AVISO_PDF_URL, AVISO_FIELDS_URL);

    // 3) PORTABILIDAD (solo si es cliente portado Y tiene datos de portabilidad)
    const tieneDatosPorta =
      String(state.data.numero_a_portarr || '').trim() &&
      String(state.data.nip             || '').trim() &&
      String(state.data.fecha_nip       || '').trim();

    if (state.data.tipo_cliente === 'portado' && tieneDatosPorta) {
      await appendTemplatePage(pdf, PORTA_PDF_URL, PORTA_FIELDS_URL);
    }

    // 4) EVIDENCIAS (excepto recibo_pago y folio_imagen en validación)
    for (const [key] of DOCS) {
      if (key === 'recibo_pago') continue;              // se maneja aparte
      if (key === 'folio_imagen' && !final) continue;
      if (state.files[key]) await appendImage(pdf, state.files[key]);
    }

    // 5) RECIBO DE PAGO → al inicio del PDF (si se cargó)
    if (state.files.recibo_pago) {
      await prependImagePage(pdf, state.files.recibo_pago);
    }

    const bytes = await pdf.save();
    const blob  = new Blob([bytes], { type: 'application/pdf' });

    // Nombre del archivo: "Nombre(s) ApellidoP ApellidoM.pdf"
    // Si es carpeta final, se le antepone el folio SIAC.
    const nombreCliente = (formatValue('nombre_apellido') || 'cliente')
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 55);

    const folio = String(state.data.folio_siac || '').trim();

    const fileName = (final && folio)
      ? `${folio} ${nombreCliente}.pdf`
      : `${nombreCliente}.pdf`;

    // Detección de iOS
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIOS) {
      const file = new File([blob], fileName, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: fileName });
          return;
        } catch (err) {
          if (err.name === 'AbortError') return;
          console.warn('Share falló, intentando fallback:', err);
        }
      }

      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 120000);
      return;
    }

    // Descarga normal (Desktop, Android)
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);

  } catch (err) {
    console.error(err);
    alert('No se pudo generar el PDF: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = final ? 'Generar carpeta final (PDF)' : 'Generar validación (PDF)';
  }
}

/* ---------------- Arranque ---------------- */

(async () => {
  try {
    const response = await fetch(FIELDS_URL);
    if (!response.ok) throw Error('Falta el JSON de Fielder.');

    state.fields = (await response.json()).fields;
    state.auth   = await load('auth') || null;

    const saved  = await load('data') || {};
    state.data   = { ...DEFAULT_DATA, ...saved };
    state.files  = (await load('files')) || {};

    if (state.auth) {
      state.data.estrategia     = state.auth.estrategia;
      state.data.clave_promotor = state.auth.clave;
      render();
    } else {
      renderLogin();
    }
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

  } catch (e) {
    $('#panel').innerHTML =
      '<div class="notice error">No se pudo iniciar: ' + esc(e.message) +
      '. Abre la app mediante GitHub Pages o un servidor local, no con doble clic en index.html.</div>';
    console.error(e);
  }
})();
