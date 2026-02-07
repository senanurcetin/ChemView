"use client"

import React from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface DataPoint {
  time: string;
  value: number;
}

interface TrendChartProps {
  title: string;
  data: DataPoint[];
  color: string;
  unit: string;
  domain?: [number, number];
}

export function TrendChart({ title, data, color, unit, domain }: TrendChartProps) {
  return (
    <Card className="h-full border-border/40 bg-card/50 backdrop-blur-sm">
      <CardHeader className="py-3">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title} ({unit})
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[180px] pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
            <XAxis 
              dataKey="time" 
              hide={true} 
            />
            <YAxis 
              domain={domain || ['auto', 'auto']} 
              fontSize={10} 
              tick={{ fill: '#666' }} 
              axisLine={false}
              tickLine={false}
              unit={unit}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#111', borderColor: '#333', fontSize: '12px' }}
              itemStyle={{ color: color }}
              labelStyle={{ display: 'none' }}
              formatter={(value: number) => [`${value.toFixed(2)} ${unit}`, title]}
            />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={color} 
              strokeWidth={2} 
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
