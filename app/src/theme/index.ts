export const colors = {
  bg: '#0B0D12',
  surface: '#141822',
  surface2: '#1B2030',
  border: '#272D3D',
  text: '#F3EDE4',
  muted: '#9AA3B2',
  accent: '#4FD1C5',
  mars: '#E4572E',
  confirm: '#FF8C32',
  contradict: '#3FA7D6',
  neutral: '#9696A0',
  danger: '#E5484D',
  ok: '#46A758',
};

export const pct = (p: number) => `${Math.round(p * 100)} %`;

export const RESULT_LABEL = { si: 'Sí', no: 'No', inconcluso: 'Inconcluso', no_aplica: 'No aplica' } as const;
