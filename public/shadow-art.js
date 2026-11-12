/* Cosmetic only: no quest, XP, reward, or storage mutations. */
function shadowStyle(level = 1, kind = 'daily') {
  const L = Math.max(1, Math.floor(Number(level) || 1));
  const army = kind === 'army';
  const width = 28 + 26 * (L - 1) / (L + 8);
  return { level: L, outline: army ? '#7B3FE4' : '#3FA9FF', width, height: width * 1.5 };
}

function shadow(on, level = 1, kind = 'daily') {
  const army = kind === 'army', style = shadowStyle(level, kind);
  const edge = on ? style.outline : '#20456b';
  const ink = army ? '#24163B' : '#0c2c50';
  const head = army ? '#35204F' : '#123d68';
  const limbs = army ? '#402663' : '#164475';
  const eyes = army ? '#D5BAFF' : '#78D9FF';
  const label = on ? `${army ? 'Purple Website army' : 'Blue daily'} shadow, level ${style.level}` : 'Unrisen shadow';
  const crown = style.level >= 7
    ? `<path d="M23 16 19 4 28 10 32 2 36 10 45 4 41 16" fill="${army ? '#3C255A' : '#123963'}"/>`
    : `<path d="M24 17 21 8 28 13 32 7 36 13 43 8 40 17" fill="${army ? '#3C255A' : '#123963'}"/>`;
  return `<svg class="shadow-figure${on ? ' risen' : ' dormant'}${army ? ' army-shadow' : ''}" viewBox="0 0 64 96" width="${style.width.toFixed(2)}" height="${style.height.toFixed(2)}" role="img" aria-label="${label}" style="--shadow-edge:${edge}">
    <title>${label}</title>
    <g stroke="${edge}" stroke-width="1.5" stroke-linejoin="miter" fill="${on ? ink : '#081728'}">
      <path d="M18 29 10 39 15 51 8 64 12 75 6 91 21 85 25 94 32 86 39 94 43 84 56 91 51 74 55 62 48 51 54 39 46 29 38 32 26 32Z"/>
      <path d="M24 15 32 10 40 15 43 26 37 35 32 39 27 35 21 26Z" fill="${on ? head : '#0a1c30'}"/>
      ${crown}
      <path d="M19 31 8 33 12 43 23 42 27 35M45 31 56 33 52 43 41 42 37 35" fill="${on ? limbs : '#0a1c30'}"/>
      <path d="M23 42 32 38 41 42 39 58 32 64 25 58Z" fill="${on ? head : '#0a1c30'}"/>
      <path d="M27 62 21 80 28 74 32 86 36 73 43 80 37 62" fill="${on ? ink : '#081728'}"/>
      <path d="M11 44 7 56 11 61 17 48M53 44 58 56 53 61 47 48"/>
    </g>
    ${on ? `<g fill="${eyes}"><path d="M25 23 30 25 29 28 25 26ZM39 23 34 25 35 28 39 26Z"/><path d="M32 43 34 49 32 54 30 49Z"/></g>
    <g fill="none" stroke="${edge}" stroke-width="1" opacity=".75"><path d="M25 19 32 16 39 19M23 45 19 57 21 65M41 45 45 57 43 65M28 68 25 80M36 68 40 81"/></g>
    <g fill="${edge}" opacity=".5"><path d="M13 67 9 79 14 75 12 86 18 78ZM49 67 55 80 50 77 52 87 46 78Z"/></g>` : ''}
  </svg>`;
}
