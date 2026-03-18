#!/usr/bin/env node
'use strict'

const { execSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const ASSETS_DIR = path.resolve(__dirname, '..', 'assets')
const TEMP_DIR = os.tmpdir()

const RESOLUTION_GROUPS = [
  {
    w: 480, h: 480,
    devices: [
      '480x480-amazfit-t-rex-3',
      '480x480-amazfit-t-rex-3-pro-48-mm',
      '480x480-amazfit-balance',
      '480x480-amazfit-balance-2',
      '480x480-amazfit-balance-2-xt',
      '480x480-amazfit-active-max',
    ],
  },
  {
    w: 466, h: 466,
    devices: [
      '466x466-amazfit-active-2-nfc-round',
      '466x466-amazfit-active-2-round',
      '466x466-amazfit-t-rex-3-pro-44-mm',
    ],
  },
  {
    w: 454, h: 454,
    devices: [
      '454x454-amazfit-t-rex-2',
      '454x454-amazfit-t-rex-ultra',
    ],
  },
  {
    w: 416, h: 416,
    devices: ['416x416-amazfit-falcon'],
  },
  {
    w: 390, h: 450,
    devices: [
      '390x450-amazfit-bip-6',
      '390x450-amazfit-active-2-nfc-square',
      '390x450-amazfit-active-2-square',
    ],
  },
]

const r = (n) => Math.round(n * 100) / 100

function resolveConvertCommand() {
  try {
    execSync('magick -version', { stdio: 'ignore' })
    return 'magick'
  } catch (_) {
    return 'convert'
  }
}

const CONVERT_CMD = resolveConvertCommand()
const STEP_THRESHOLD_OPTIONS = Array.from({ length: 10 }, (_, index) => (index + 1) * 1000)
const MUG_BUBBLE_FRAMES = 3

function svgToPng(svgContent, outPath) {
  const tmpSvg = path.join(TEMP_DIR, `beertime_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2)}.svg`)
  try {
    fs.writeFileSync(tmpSvg, svgContent, 'utf8')
    execSync(
      `${CONVERT_CMD} -background none "${tmpSvg}" -alpha on -strip -depth 8 -define png:bit-depth=8 -define png:color-type=6 "PNG32:${outPath}"`,
      { stdio: 'pipe' }
    )
  } finally {
    try { fs.unlinkSync(tmpSvg) } catch (_) {}
  }
}

function copyToDevices(srcPath, filename, devices) {
  for (const device of devices) {
    const outPath = path.join(ASSETS_DIR, device, filename)
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.copyFileSync(srcPath, outPath)
  }
}

function emptySVG(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="transparent"/>
</svg>`
}

function headerOverlaySVG(w, h) {
  const timeW = w * 0.5
  const timeH = h * 0.13
  const timeX = (w - timeW) / 2
  const timeY = h * 0.04

  const dateW = w * 0.38
  const dateH = h * 0.07
  const dateX = (w - dateW) / 2
  const dateY = h * 0.157

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="transparent"/>
  <rect x="${r(timeX)}" y="${r(timeY)}" width="${r(timeW)}" height="${r(timeH)}" rx="${r(timeH * 0.45)}" fill="#000000" fill-opacity="0.52"/>
  <rect x="${r(dateX)}" y="${r(dateY)}" width="${r(dateW)}" height="${r(dateH)}" rx="${r(dateH * 0.45)}" fill="#000000" fill-opacity="0.48"/>
</svg>`
}

function editSelectSVG(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${r(size * 0.24)}" fill="#000000" fill-opacity="0.2"/>
  <rect x="${r(size * 0.04)}" y="${r(size * 0.04)}" width="${r(size * 0.92)}" height="${r(size * 0.92)}" rx="${r(size * 0.22)}" fill="none" stroke="#f2d49a" stroke-width="${r(size * 0.06)}"/>
</svg>`
}

function editMaskSVG(w, h, opacity) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="#000000" fill-opacity="0"/>
</svg>`
}

function sevenSegmentNumberSVG(x, y, value, digitW, digitH, color) {
  const text = String(value)
  const thickness = digitW * 0.16
  const gap = digitW * 0.18
  const hLen = digitW - thickness * 1.6
  const vLen = (digitH - thickness * 3) / 2
  const segmentsByDigit = {
    '0': ['a', 'b', 'c', 'd', 'e', 'f'],
    '1': ['b', 'c'],
    '2': ['a', 'b', 'g', 'e', 'd'],
    '3': ['a', 'b', 'g', 'c', 'd'],
    '4': ['f', 'g', 'b', 'c'],
    '5': ['a', 'f', 'g', 'c', 'd'],
    '6': ['a', 'f', 'g', 'e', 'c', 'd'],
    '7': ['a', 'b', 'c'],
    '8': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    '9': ['a', 'b', 'c', 'd', 'f', 'g'],
  }

  return text.split('').map((digit, index) => {
    const dx = x + index * (digitW + gap)
    const dy = y
    const segments = {
      a: { x: dx + thickness * 0.8, y: dy, w: hLen, h: thickness },
      b: { x: dx + digitW - thickness, y: dy + thickness * 0.7, w: thickness, h: vLen },
      c: { x: dx + digitW - thickness, y: dy + thickness * 1.9 + vLen, w: thickness, h: vLen },
      d: { x: dx + thickness * 0.8, y: dy + digitH - thickness, w: hLen, h: thickness },
      e: { x: dx, y: dy + thickness * 1.9 + vLen, w: thickness, h: vLen },
      f: { x: dx, y: dy + thickness * 0.7, w: thickness, h: vLen },
      g: { x: dx + thickness * 0.8, y: dy + digitH / 2 - thickness / 2, w: hLen, h: thickness },
    }

    return (segmentsByDigit[digit] || []).map((segmentKey) => {
      const segment = segments[segmentKey]
      return `<rect x="${r(segment.x)}" y="${r(segment.y)}" width="${r(segment.w)}" height="${r(segment.h)}" rx="${r(thickness * 0.35)}" fill="${color}"/>`
    }).join('')
  }).join('')
}

function sevenSegmentClockSVG(x, y, value, digitW, digitH, color) {
  const text = String(value)
  const gap = digitW * 0.18
  let cursorX = x

  return text.split('').map((char) => {
    if (char === ':') {
      const dotR = digitW * 0.07
      const cx = cursorX + digitW * 0.18
      const topCy = y + digitH * 0.34
      const bottomCy = y + digitH * 0.68
      cursorX += digitW * 0.36
      return `<circle cx="${r(cx)}" cy="${r(topCy)}" r="${r(dotR)}" fill="${color}"/><circle cx="${r(cx)}" cy="${r(bottomCy)}" r="${r(dotR)}" fill="${color}"/>`
    }

    const svg = sevenSegmentNumberSVG(cursorX, y, char, digitW, digitH, color)
    cursorX += digitW + gap
    return svg
  }).join('')
}

function pixelTextSVG(x, y, text, cell, color) {
  const glyphs = {
    '0': [
      '01110',
      '10001',
      '10011',
      '10101',
      '11001',
      '10001',
      '01110',
    ],
    '2': [
      '01110',
      '10001',
      '00001',
      '00010',
      '00100',
      '01000',
      '11111',
    ],
    A: [
      '01110',
      '10001',
      '10001',
      '11111',
      '10001',
      '10001',
      '10001',
    ],
    D: [
      '11110',
      '10001',
      '10001',
      '10001',
      '10001',
      '10001',
      '11110',
    ],
    F: [
      '11111',
      '10000',
      '10000',
      '11110',
      '10000',
      '10000',
      '10000',
    ],
    I: [
      '11111',
      '00100',
      '00100',
      '00100',
      '00100',
      '00100',
      '11111',
    ],
    M: [
      '10001',
      '11011',
      '10101',
      '10101',
      '10001',
      '10001',
      '10001',
    ],
    N: [
      '10001',
      '11001',
      '10101',
      '10011',
      '10001',
      '10001',
      '10001',
    ],
    O: [
      '01110',
      '10001',
      '10001',
      '10001',
      '10001',
      '10001',
      '01110',
    ],
    R: [
      '11110',
      '10001',
      '10001',
      '11110',
      '10100',
      '10010',
      '10001',
    ],
    Y: [
      '10001',
      '10001',
      '01010',
      '00100',
      '00100',
      '00100',
      '00100',
    ],
    S: [
      '11111',
      '10000',
      '10000',
      '11111',
      '00001',
      '00001',
      '11111',
    ],
    T: [
      '11111',
      '00100',
      '00100',
      '00100',
      '00100',
      '00100',
      '00100',
    ],
    E: [
      '11111',
      '10000',
      '10000',
      '11110',
      '10000',
      '10000',
      '11111',
    ],
    P: [
      '11110',
      '10001',
      '10001',
      '11110',
      '10000',
      '10000',
      '10000',
    ],
    ' ': [
      '000',
      '000',
      '000',
      '000',
      '000',
      '000',
      '000',
    ],
  }

  let cursorX = x
  return text.split('').map((char) => {
    const glyph = glyphs[char] || glyphs[' ']
    const glyphWidth = glyph[0].length
    const svg = glyph.map((row, rowIndex) => (
      row.split('').map((bit, colIndex) => (
        bit === '1'
          ? `<rect x="${r(cursorX + colIndex * cell)}" y="${r(y + rowIndex * cell)}" width="${r(cell * 0.9)}" height="${r(cell * 0.9)}" rx="${r(cell * 0.18)}" fill="${color}"/>`
          : ''
      )).join('')
    )).join('')
    cursorX += (glyphWidth + 1) * cell
    return svg
  }).join('')
}

function editFaceSVG(w, h, steps) {
  const mugW = w * 0.72
  const mugH = h * 0.72
  const mugX = (w - mugW) / 2
  const mugY = h * 0.16
  const panelW = w * 0.56
  const panelH = h * 0.2
  const panelX = (w - panelW) / 2
  const panelY = h * 0.08
  const digitW = w * 0.07
  const digitH = h * 0.078
  const digitGap = digitW * 0.18
  const digitCount = String(steps).length
  const digitsTotalW = digitCount * digitW + (digitCount - 1) * digitGap
  const digitsX = (w - digitsTotalW) / 2
  const digitsY = panelY + panelH * 0.52
  const labelCell = w * 0.0085
  const labelText = 'STEPS'
  const labelWidth = labelText.split('').reduce((sum, char) => {
    const glyphWidths = { S: 5, T: 5, E: 5, P: 5, ' ': 3 }
    return sum + ((glyphWidths[char] || 3) + 1) * labelCell
  }, -labelCell)
  const labelX = (w - labelWidth) / 2
  const labelY = panelY + panelH * 0.1

  return `${bgSVG(w, h).replace(
    '</svg>',
    `  <g transform="translate(${r(mugX)}, ${r(mugY)})">
    ${mugSVG(mugW, mugH, 0.72, false)
      .replace('<svg xmlns="http://www.w3.org/2000/svg" width="' + mugW + '" height="' + mugH + '">', '')
      .replace('</svg>', '')}
  </g>
  <rect x="${r(panelX)}" y="${r(panelY)}" width="${r(panelW)}" height="${r(panelH)}" rx="${r(panelH * 0.36)}" fill="#120b05" fill-opacity="0.82" stroke="#f2d49a" stroke-opacity="0.34" stroke-width="${r(h * 0.004)}"/>
  ${pixelTextSVG(labelX, labelY, labelText, labelCell, '#d8b676')}
  ${sevenSegmentNumberSVG(digitsX, digitsY, steps, digitW, digitH, '#fff7e1')}
</svg>`
  )}`
}

function editPreviewSVG(w, h, steps) {
  return editFaceSVG(w, h, steps)
}

function editBackgroundSVG(w, h, steps) {
  return editFaceSVG(w, h, steps)
}

function sharedDefs(w, h) {
  const glowR = Math.max(w, h) * 0.42

  return `
  <defs>
    <linearGradient id="beerGlass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.28"/>
      <stop offset="48%" stop-color="#f6e7cf" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#856c48" stop-opacity="0.18"/>
    </linearGradient>
    <linearGradient id="beerFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffd56b"/>
      <stop offset="42%" stop-color="#f2ac24"/>
      <stop offset="100%" stop-color="#b75f05"/>
    </linearGradient>
    <linearGradient id="beerShine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#fff8d7" stop-opacity="0.55"/>
      <stop offset="28%" stop-color="#fff8d7" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="bgGlow" cx="50%" cy="44%" r="70%">
      <stop offset="0%" stop-color="#4b2407"/>
      <stop offset="40%" stop-color="#261005"/>
      <stop offset="100%" stop-color="#080402"/>
    </radialGradient>
    <radialGradient id="centerGlow" cx="50%" cy="47%" r="70%">
      <stop offset="0%" stop-color="#ffb545" stop-opacity="0.22"/>
      <stop offset="55%" stop-color="#ffb545" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="#ffb545" stop-opacity="0"/>
    </radialGradient>
    <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="${r(w * 0.012)}" result="blur"/>
      <feOffset dy="${r(h * 0.012)}" result="offsetBlur"/>
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.35"/>
      </feComponentTransfer>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="miniShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="${r(w * 0.006)}" result="blur"/>
      <feOffset dy="${r(h * 0.006)}" result="offsetBlur"/>
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.35"/>
      </feComponentTransfer>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <radialGradient id="iconBg" cx="50%" cy="40%" r="75%">
      <stop offset="0%" stop-color="#4e2405"/>
      <stop offset="65%" stop-color="#1d0d03"/>
      <stop offset="100%" stop-color="#090402"/>
    </radialGradient>
    <clipPath id="iconClip">
      <rect x="${r(w * 0.08)}" y="${r(h * 0.08)}" width="${r(w * 0.84)}" height="${r(h * 0.84)}" rx="${r(w * 0.23)}"/>
    </clipPath>
    <radialGradient id="ambientGlow" cx="50%" cy="50%" r="${r(glowR)}">
      <stop offset="0%" stop-color="#ffcb63" stop-opacity="0.26"/>
      <stop offset="100%" stop-color="#ffcb63" stop-opacity="0"/>
    </radialGradient>
  </defs>`
}

function bgSVG(w, h) {
  const dots = Array.from({ length: 10 }, (_, i) => {
    const x = w * (0.12 + (i % 5) * 0.18)
    const y = h * (0.18 + Math.floor(i / 5) * 0.48 + (i % 2) * 0.05)
    const radius = w * (0.012 + (i % 3) * 0.003)
    return `<circle cx="${r(x)}" cy="${r(y)}" r="${r(radius)}" fill="#ffc765" fill-opacity="0.08"/>`
  }).join('')

  const arcs = Array.from({ length: 6 }, (_, i) => {
    const y = h * (0.22 + i * 0.1)
    const opacity = 0.035 + (i % 2) * 0.015
    return `<path d="M ${r(w * 0.08)} ${r(y)} Q ${r(w * 0.5)} ${r(y - h * 0.06)} ${r(w * 0.92)} ${r(y)}" stroke="#ffffff" stroke-opacity="${opacity}" stroke-width="${r(h * 0.004)}" fill="none"/>`
  }).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  ${sharedDefs(w, h)}
  <rect width="${w}" height="${h}" fill="url(#bgGlow)"/>
  <rect width="${w}" height="${h}" fill="url(#centerGlow)"/>
  <ellipse cx="${r(w * 0.5)}" cy="${r(h * 0.58)}" rx="${r(w * 0.34)}" ry="${r(h * 0.28)}" fill="url(#ambientGlow)"/>
  ${arcs}
  ${dots}
</svg>`
}

function buildMugGeometry(w, h) {
  const mugW = w * 0.42
  const mugH = h * 0.58
  const left = (w - mugW) / 2
  const top = h * 0.18
  const right = left + mugW
  const bottom = top + mugH
  const inset = mugW * 0.055
  const lipH = mugH * 0.09
  const innerLeft = left + inset
  const innerRight = right - inset
  const innerTop = top + lipH * 0.5
  const innerBottom = bottom - mugH * 0.028
  const handleOuterX = right + mugW * 0.18
  const handleInnerX = right + mugW * 0.06
  const handleTop = top + mugH * 0.18
  const handleBottom = top + mugH * 0.72
  const glassRadius = mugW * 0.08
  const bodyPath = [
    `M ${r(left + glassRadius)} ${r(top)}`,
    `L ${r(right - glassRadius)} ${r(top)}`,
    `Q ${r(right)} ${r(top)} ${r(right)} ${r(top + glassRadius)}`,
    `L ${r(right)} ${r(bottom - glassRadius)}`,
    `Q ${r(right)} ${r(bottom)} ${r(right - glassRadius)} ${r(bottom)}`,
    `L ${r(left + glassRadius)} ${r(bottom)}`,
    `Q ${r(left)} ${r(bottom)} ${r(left)} ${r(bottom - glassRadius)}`,
    `L ${r(left)} ${r(top + glassRadius)}`,
    `Q ${r(left)} ${r(top)} ${r(left + glassRadius)} ${r(top)}`,
    'Z',
  ].join(' ')

  return {
    left,
    top,
    right,
    bottom,
    innerLeft,
    innerRight,
    innerTop,
    innerBottom,
    handleOuterX,
    handleInnerX,
    handleTop,
    handleBottom,
    lipH,
    mugW,
    mugH,
    bodyPath,
  }
}

function buildMugBubbles(w, h, fillLevel, isMini = false, bubblePhase = 0) {
  const g = buildMugGeometry(w, h)
  const safeFill = Math.max(0, Math.min(1, fillLevel))
  const beerHeight = (g.innerBottom - g.innerTop) * safeFill
  const beerTop = g.innerBottom - beerHeight
  const frame = ((bubblePhase % MUG_BUBBLE_FRAMES) + MUG_BUBBLE_FRAMES) % MUG_BUBBLE_FRAMES

  const bubbleCount = safeFill < 0.18 ? 0 : (isMini ? 4 : 8)
  const bubbles = Array.from({ length: bubbleCount }, (_, i) => {
    const horizontalBase = 0.18 + ((i * 17) % 67) / 100
    const baseX = g.innerLeft + (g.innerRight - g.innerLeft) * horizontalBase
    const baseY = beerTop + beerHeight * (0.12 + ((i * 13) % 68) / 100)
    const lateralShift = frame * w * (isMini ? 0.003 : 0.005) * (i % 2 === 0 ? 1 : -1)
    const upwardShift = frame * beerHeight * (isMini ? 0.05 : 0.08)
    let by = baseY - upwardShift
    if (by < beerTop + beerHeight * 0.08) {
      by += beerHeight * 0.26
    }
    const bx = baseX + lateralShift
    const br = Math.max(1.2, w * (isMini ? 0.012 : 0.008) * (1 + (i % 3) * 0.2))
    const opacity = 0.16 + (i % 3) * 0.08
    return `<circle cx="${r(bx)}" cy="${r(by)}" r="${r(br)}" fill="#fff4d2" fill-opacity="${opacity}" clip-path="url(#mugInnerClip)"/>`
  }).join('')

  return {
    geometry: g,
    safeFill,
    beerHeight,
    beerTop,
    bubbles,
  }
}

function mugBubbleLayerSVG(w, h, fillLevel, bubblePhase = 0) {
  const { geometry: g, bubbles } = buildMugBubbles(w, h, fillLevel, false, bubblePhase)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <clipPath id="mugInnerClip">
      <rect x="${r(g.innerLeft)}" y="${r(g.innerTop)}" width="${r(g.innerRight - g.innerLeft)}" height="${r(g.innerBottom - g.innerTop)}" rx="${r(g.mugW * 0.05)}"/>
    </clipPath>
  </defs>
  ${bubbles}
</svg>`
}

function mugSVG(w, h, fillLevel, isMini = false, bubblePhase = 0) {
  const { geometry: g, safeFill, beerHeight, beerTop, bubbles } = buildMugBubbles(w, h, fillLevel, isMini, bubblePhase)
  const foamVisible = safeFill > 0.9
  const strokeW = Math.max(2, w * (isMini ? 0.016 : 0.012))
  const handleW = Math.max(4, w * (isMini ? 0.06 : 0.05))
  const shadowFilter = isMini ? 'miniShadow' : 'softShadow'

  const foam = foamVisible
    ? Array.from({ length: isMini ? 6 : 10 }, (_, i) => {
        const bx = g.innerLeft + (g.innerRight - g.innerLeft) * (i + 0.5) / (isMini ? 6 : 10)
        const br = w * (isMini ? 0.022 : 0.026) * (0.82 + (i % 3) * 0.12)
        const foamLift = safeFill > 0.985 ? br * 0.72 : br * 0.15
        return `<circle cx="${r(bx)}" cy="${r(beerTop - foamLift)}" r="${r(br)}" fill="#fff6dd" fill-opacity="0.96" clip-path="url(#foamClip)"/>`
      }).join('')
    : ''

  const beer = safeFill > 0
    ? `
      <rect x="${r(g.innerLeft)}" y="${r(beerTop)}" width="${r(g.innerRight - g.innerLeft)}" height="${r(beerHeight)}" fill="#d07a11" clip-path="url(#mugInnerClip)"/>
      <rect x="${r(g.innerLeft)}" y="${r(beerTop)}" width="${r(g.innerRight - g.innerLeft)}" height="${r(Math.max(2, beerHeight * 0.34))}" fill="#f4c04d" fill-opacity="0.88" clip-path="url(#mugInnerClip)"/>
      <rect x="${r(g.innerLeft + (g.innerRight - g.innerLeft) * 0.14)}" y="${r(beerTop)}" width="${r((g.innerRight - g.innerLeft) * 0.16)}" height="${r(beerHeight)}" fill="#fff0be" fill-opacity="0.18" clip-path="url(#mugInnerClip)"/>
      ${bubbles}
      ${foam}
    `
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  ${sharedDefs(w, h)}
  <defs>
    <clipPath id="mugInnerClip">
      <rect x="${r(g.innerLeft)}" y="${r(g.innerTop)}" width="${r(g.innerRight - g.innerLeft)}" height="${r(g.innerBottom - g.innerTop)}" rx="${r(g.mugW * 0.05)}"/>
    </clipPath>
    <clipPath id="foamClip">
      <rect x="${r(g.innerLeft - w * 0.03)}" y="${r(g.top - h * 0.08)}" width="${r(g.innerRight - g.innerLeft + w * 0.06)}" height="${r(g.innerBottom - g.top + h * 0.1)}"/>
    </clipPath>
  </defs>
  <g filter="url(#${shadowFilter})">
    <ellipse cx="${r(w * 0.5)}" cy="${r(h * 0.82)}" rx="${r(w * 0.16)}" ry="${r(h * 0.04)}" fill="#000000" fill-opacity="0.24"/>
    <path d="${g.bodyPath}" fill="#f4e1bd" fill-opacity="0.12" stroke="#f5e0bb" stroke-opacity="0.92" stroke-width="${r(strokeW)}"/>
    ${beer}
    <path d="${g.bodyPath}" fill="none" stroke="#fff9ea" stroke-opacity="0.28" stroke-width="${r(Math.max(1.5, strokeW * 0.38))}"/>
    <path d="M ${r(g.handleInnerX)} ${r(g.handleTop)} Q ${r(g.handleOuterX)} ${r(g.handleTop)} ${r(g.handleOuterX)} ${r((g.handleTop + g.handleBottom) / 2)} Q ${r(g.handleOuterX)} ${r(g.handleBottom)} ${r(g.handleInnerX)} ${r(g.handleBottom)}"
      fill="none" stroke="#f4ddba" stroke-opacity="0.82" stroke-width="${r(handleW)}" stroke-linecap="round"/>
    <path d="M ${r(g.handleInnerX + handleW * 0.2)} ${r(g.handleTop + handleW * 0.26)} Q ${r(g.handleOuterX - handleW * 0.5)} ${r(g.handleTop + handleW * 0.18)} ${r(g.handleOuterX - handleW * 0.4)} ${r((g.handleTop + g.handleBottom) / 2)} Q ${r(g.handleOuterX - handleW * 0.5)} ${r(g.handleBottom - handleW * 0.18)} ${r(g.handleInnerX + handleW * 0.2)} ${r(g.handleBottom - handleW * 0.26)}"
      fill="none" stroke="#180f09" stroke-opacity="0.42" stroke-width="${r(handleW * 0.35)}" stroke-linecap="round"/>
    <ellipse cx="${r((g.left + g.right) / 2)}" cy="${r(g.top + g.lipH * 0.25)}" rx="${r(g.mugW * 0.42)}" ry="${r(g.lipH * 0.5)}" fill="#fff8eb" fill-opacity="0.18"/>
  </g>
</svg>`
}

function iconSVG(size) {
  const timeText = '07:42'
  const timeDigitW = size * 0.102
  const timeDigitH = size * 0.155
  const timeGap = timeDigitW * 0.18
  const timeWidth = timeText.split('').reduce((sum, char) => sum + (char === ':' ? timeDigitW * 0.36 : timeDigitW) + timeGap, -timeGap)
  const timeX = (size - timeWidth) / 2
  const timeY = size * 0.065
  const dateText = 'FRI 20 MAR'
  const dateCell = size * 0.0095
  const dateWidths = { F: 5, R: 5, I: 5, M: 5, A: 5, D: 5, ' ': 3, '2': 5, '0': 5 }
  const dateWidth = dateText.split('').reduce((sum, char) => sum + ((dateWidths[char] || 5) + 1) * dateCell, -dateCell)
  const dateX = (size - dateWidth) / 2
  const dateY = size * 0.22
  const mugWidth = size * 0.94
  const mugHeight = size * 0.94
  const mugX = (size - mugWidth) / 2
  const mugY = size * 0.14

  return `${bgSVG(size, size).replace(
    '</svg>',
    `  <rect x="${r(size * 0.21)}" y="${r(size * 0.055)}" width="${r(size * 0.58)}" height="${r(size * 0.145)}" rx="${r(size * 0.07)}" fill="#000000" fill-opacity="0.48"/>
  <rect x="${r(size * 0.28)}" y="${r(size * 0.205)}" width="${r(size * 0.44)}" height="${r(size * 0.06)}" rx="${r(size * 0.03)}" fill="#000000" fill-opacity="0.42"/>
  ${sevenSegmentClockSVG(timeX, timeY, timeText, timeDigitW, timeDigitH, '#f5e7c8')}
  ${pixelTextSVG(dateX, dateY, dateText, dateCell, '#d8b676')}
  <g transform="translate(${r(mugX)}, ${r(mugY)})">
    ${mugSVG(mugWidth, mugHeight, 0.95, false)
      .replace('<svg xmlns="http://www.w3.org/2000/svg" width="' + mugWidth + '" height="' + mugHeight + '">', '')
      .replace('</svg>', '')}
  </g>
</svg>`
  )}`
}

function main() {
  console.log('Generating BeerTime assets...\n')

  for (const group of RESOLUTION_GROUPS) {
    const { w, h, devices } = group
    console.log(`${w}x${h}  (${devices.length} device${devices.length > 1 ? 's' : ''})`)

    process.stdout.write('  bg.png ... ')
    const tmpBg = path.join(TEMP_DIR, `beertime_bg_${w}x${h}.png`)
    svgToPng(bgSVG(w, h), tmpBg)
    copyToDevices(tmpBg, 'bg.png', devices)
    console.log('done')

    process.stdout.write('  header_overlay.png ... ')
    const tmpHeader = path.join(TEMP_DIR, `beertime_header_${w}x${h}.png`)
    svgToPng(headerOverlaySVG(w, h), tmpHeader)
    copyToDevices(tmpHeader, 'header_overlay.png', devices)
    console.log('done')

    process.stdout.write('  edit_select.png ... ')
    const editSelectSize = Math.round(Math.min(w, h) * 0.24)
    const tmpEditSelect = path.join(TEMP_DIR, `beertime_edit_select_${w}x${h}.png`)
    svgToPng(editSelectSVG(editSelectSize), tmpEditSelect)
    copyToDevices(tmpEditSelect, 'edit_select.png', devices)
    console.log('done')

    process.stdout.write('  edit_mask_100.png ... ')
    const tmpMask100 = path.join(TEMP_DIR, `beertime_edit_mask_100_${w}x${h}.png`)
    svgToPng(editMaskSVG(w, h, 1), tmpMask100)
    copyToDevices(tmpMask100, 'edit_mask_100.png', devices)
    console.log('done')

    process.stdout.write('  edit_mask_70.png ... ')
    const tmpMask70 = path.join(TEMP_DIR, `beertime_edit_mask_70_${w}x${h}.png`)
    svgToPng(editMaskSVG(w, h, 0.7), tmpMask70)
    copyToDevices(tmpMask70, 'edit_mask_70.png', devices)
    console.log('done')

    for (const steps of STEP_THRESHOLD_OPTIONS) {
      const bgName = `edit_bg_steps_${steps}.png`
      process.stdout.write(`  ${bgName} ... `)
      const tmpEditBg = path.join(TEMP_DIR, `beertime_edit_bg_${w}x${h}_${steps}.png`)
      svgToPng(editBackgroundSVG(w, h, steps), tmpEditBg)
      copyToDevices(tmpEditBg, bgName, devices)
      console.log('done')
    }

    for (const steps of STEP_THRESHOLD_OPTIONS) {
      const name = `edit_steps_${steps}.png`
      process.stdout.write(`  ${name} ... `)
      const tmpPreview = path.join(TEMP_DIR, `beertime_edit_preview_${w}x${h}_${steps}.png`)
      svgToPng(editPreviewSVG(w, h, steps), tmpPreview)
      copyToDevices(tmpPreview, name, devices)
      console.log('done')
    }

    for (let i = 0; i <= 10; i++) {
      const name = `mug_${String(i).padStart(2, '0')}.png`
      process.stdout.write(`  ${name} ... `)
      const tmp = path.join(TEMP_DIR, `beertime_mug_static_${w}x${h}_${i}.png`)
      svgToPng(mugSVG(w, h, i / 10, false, 0), tmp)
      copyToDevices(tmp, name, devices)
      console.log('done')
    }

    for (let i = 0; i <= 10; i++) {
      const folder = `mug_anim_${String(i).padStart(2, '0')}`
      for (let frame = 0; frame < MUG_BUBBLE_FRAMES; frame++) {
        const name = `${folder}/frame_${frame}.png`
        process.stdout.write(`  ${name} ... `)
        const tmp = path.join(TEMP_DIR, `beertime_mug_anim_${w}x${h}_${i}_${frame}.png`)
        svgToPng(mugBubbleLayerSVG(w, h, i / 10, frame), tmp)
        copyToDevices(tmp, name, devices)
        console.log('done')
      }
    }

    process.stdout.write('  mug_mini.png ... ')
    const miniW = Math.round(w * 0.12)
    const miniH = Math.round(miniW * 1.1)
    const tmpMini = path.join(TEMP_DIR, `beertime_mini_${w}x${h}.png`)
    svgToPng(mugSVG(miniW, miniH, 1, true), tmpMini)
    copyToDevices(tmpMini, 'mug_mini.png', devices)
    console.log('done')

    process.stdout.write('  blank.png ... ')
    const tmpBlank = path.join(TEMP_DIR, `beertime_blank_${w}x${h}.png`)
    svgToPng(emptySVG(miniW, miniH), tmpBlank)
    copyToDevices(tmpBlank, 'blank.png', devices)
    console.log('done')

    process.stdout.write('  icon.png ... ')
    const tmpIcon = path.join(TEMP_DIR, `beertime_icon_${w}x${h}.png`)
    svgToPng(iconSVG(Math.min(w, h)), tmpIcon)
    copyToDevices(tmpIcon, 'icon.png', devices)
    console.log('done')

    console.log()
  }

  console.log('All assets generated.')
}

main()
