'use server';

/**
 * @fileOverview A flow for generating intelligent alerts based on sensor data, considering past states and thresholds.
 *
 * - generateIntelligentAlert - A function that generates specific and actionable alerts.
 * - IntelligentAlertInput - The input type for the generateIntelligentAlert function.
 * - IntelligentAlertOutput - The return type for the generateIntelligentAlert function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const IntelligentAlertInputSchema = z.object({
  mixingSpeedRpm: z.number().describe('The current mixing speed in RPM.'),
  temperatureCelsius: z.number().describe('The current temperature in degrees Celsius.'),
  pHLevel: z.number().describe('The current pH level.'),
  valveStatus: z.string().describe('The current status of the valve (open or closed).'),
  pastStates: z.array(z.object({
    mixingSpeedRpm: z.number().describe('Past mixing speed in RPM.'),
    temperatureCelsius: z.number().describe('Past temperature in degrees Celsius.'),
    pHLevel: z.number().describe('Past pH level.'),
    valveStatus: z.string().describe('Past status of the valve (open or closed).'),
    timestamp: z.string().describe('Timestamp of the past state.'),
  })).describe('An array of past sensor states.'),
  temperatureThreshold: z.number().default(50).describe('The threshold in degrees Celsius above which a temperature alert should be triggered'),
  rpmThreshold: z.number().default(100).describe('The threshold in RPM below which a mixing speed alert should be triggered'),
  phUpperThreshold: z.number().default(8).describe('The upper pH threshold, above which a pH alert should be triggered'),
  phLowerThreshold: z.number().default(6).describe('The lower pH threshold, below which a pH alert should be triggered'),
});

export type IntelligentAlertInput = z.infer<typeof IntelligentAlertInputSchema>;

const IntelligentAlertOutputSchema = z.object({
  alertMessage: z.string().describe('A specific and actionable alert message for the operator.'),
  urgencyLevel: z.enum(['low', 'medium', 'high']).describe('The urgency level of the alert.'),
});

export type IntelligentAlertOutput = z.infer<typeof IntelligentAlertOutputSchema>;

export async function generateIntelligentAlert(input: IntelligentAlertInput): Promise<IntelligentAlertOutput> {
  return intelligentAlertFlow(input);
}

const intelligentAlertPrompt = ai.definePrompt({
  name: 'intelligentAlertPrompt',
  input: { schema: IntelligentAlertInputSchema },
  output: { schema: IntelligentAlertOutputSchema },
  prompt: `You are an intelligent alerting system for a chemical mixing tank. Analyze the real-time sensor data, considering past states and defined thresholds, to generate specific and actionable alerts for the operator. Provide context and recommendations in the alert message.

Current Sensor Data:
- Mixing Speed: {{mixingSpeedRpm}} RPM
- Temperature: {{temperatureCelsius}} °C
- pH Level: {{pHLevel}}
- Valve Status: {{valveStatus}}
- Temperature Threshold: {{temperatureThreshold}} °C
- RPM Threshold: {{rpmThreshold}} RPM
- pH Upper Threshold: {{phUpperThreshold}}
- pH Lower Threshold: {{phLowerThreshold}}

Past States:
{{#each pastStates}}
- Timestamp: {{timestamp}}, Mixing Speed: {{mixingSpeedRpm}} RPM, Temperature: {{temperatureCelsius}} °C, pH Level: {{pHLevel}}, Valve Status: {{valveStatus}}
{{/each}}

Consider the following when generating alerts:
- Temperature exceeding the threshold of {{temperatureThreshold}} °C.
- Mixing speed dropping below the threshold of {{rpmThreshold}} RPM.
- pH level going above {{phUpperThreshold}} or below {{phLowerThreshold}}.
- Valve status changes that are unexpected.

Output an alert with an urgency level. Urgency levels can be low, medium, or high.
`,
});

const intelligentAlertFlow = ai.defineFlow(
  {
    name: 'intelligentAlertFlow',
    inputSchema: IntelligentAlertInputSchema,
    outputSchema: IntelligentAlertOutputSchema,
  },
  async (input) => {
    const { output } = await intelligentAlertPrompt(input);
    return output!;
  }
);
