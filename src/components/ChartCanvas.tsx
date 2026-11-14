import { useEffect, useRef } from 'react';
import Chart, { ChartConfiguration } from 'chart.js/auto';

interface ChartCanvasProps {
  config: ChartConfiguration;
  heightClass?: string;
  ariaLabel: string;
}

export function ChartCanvas({
  config,
  heightClass = 'h-64',
  ariaLabel,
}: ChartCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    chartRef.current = new Chart(canvas, config);

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [config]);

  return (
    <div className={`relative w-full ${heightClass}`}>
      <canvas ref={canvasRef} aria-label={ariaLabel} role="img" />
    </div>
  );
}

export function getChartTheme(isDark: boolean) {
  return {
    textColor: isDark ? '#D4D4D8' : '#3F3F46',
    mutedText: isDark ? '#A1A1AA' : '#71717A',
    gridColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(10, 10, 11, 0.06)',
    surfaceBg: isDark ? '#141416' : '#FFFFFF',
    tooltipBg: isDark ? '#1F1F23' : '#0A0A0B',
    tooltipText: '#FFFFFF',
    shellYellow: '#FFC800',
    shellOrange: '#F58220',
    shellBlack: isDark ? '#F4F4F5' : '#18181B',
    shellSlate: isDark ? '#71717A' : '#A1A1AA',
    fontMono: "'JetBrains Mono', monospace",
    fontSans: "'Public Sans', sans-serif",
  };
}
