import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors, fontSize, spacing } from '@/theme';

type Point = { label: string; value: number };

type Props = {
  points: Point[];
  formatValue: (value: number) => string;
  maxValue?: number;
  height?: number;
};

const AXIS_WIDTH = 52;
const PADDING_TOP = 8;
const GRID_LINES = 4;

export function LineChart({ points, formatValue, maxValue, height = 160 }: Props) {
  const [width, setWidth] = useState(0);
  const plotWidth = Math.max(0, width - AXIS_WIDTH);
  const plotHeight = height - PADDING_TOP;
  const top = maxValue ?? niceMax(Math.max(...points.map((p) => p.value), 1));

  const x = (index: number) => AXIS_WIDTH + (points.length > 1 ? (index / (points.length - 1)) * plotWidth : 0);
  const y = (value: number) => PADDING_TOP + plotHeight * (1 - Math.min(value, top) / top);

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${height} L${AXIS_WIDTH},${height} Z`;

  const xLabels = [0, Math.floor((points.length - 1) / 2), points.length - 1];
  const last = points.length - 1;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && points.length > 0 && (
        <>
          <View style={{ height }}>
            <Svg width={width} height={height}>
              <Defs>
                <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.primary} stopOpacity={0.25} />
                  <Stop offset="1" stopColor={colors.primary} stopOpacity={0.02} />
                </LinearGradient>
              </Defs>
              {Array.from({ length: GRID_LINES + 1 }, (_, i) => {
                const gy = PADDING_TOP + (plotHeight * i) / GRID_LINES;
                return <Line key={i} x1={AXIS_WIDTH} x2={width} y1={gy} y2={gy} stroke={colors.border} strokeWidth={1} />;
              })}
              <Path d={area} fill="url(#fill)" />
              <Path d={line} fill="none" stroke={colors.primary} strokeWidth={2.5}
                strokeLinejoin="round" strokeLinecap="round" />
              <Circle cx={x(last)} cy={y(points[last].value)} r={4} fill={colors.surface}
                stroke={colors.primary} strokeWidth={2.5} />
            </Svg>
            {Array.from({ length: GRID_LINES + 1 }, (_, i) => (
              <Text key={i} numberOfLines={1}
                style={[styles.yLabel, { top: PADDING_TOP + (plotHeight * i) / GRID_LINES - 8 }]}>
                {formatValue(top * (1 - i / GRID_LINES))}
              </Text>
            ))}
          </View>
          <View style={styles.xAxis}>
            {xLabels.map((index, i) => (
              <Text key={i} style={styles.xLabel}>{points[index].label}</Text>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function niceMax(value: number): number {
  const power = Math.pow(10, Math.floor(Math.log10(value)));
  const step = [2, 4, 8, 10].find((s) => s * power >= value) ?? 10;
  return step * power;
}

const styles = StyleSheet.create({
  yLabel: {
    position: 'absolute',
    left: 0,
    width: AXIS_WIDTH - spacing.sm,
    textAlign: 'right',
    fontSize: fontSize.xs,
    color: colors.textMuted,
    backgroundColor: colors.surface,
  },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginLeft: AXIS_WIDTH,
    marginTop: spacing.xs,
  },
  xLabel: { fontSize: fontSize.xs, color: colors.textMuted },
});
