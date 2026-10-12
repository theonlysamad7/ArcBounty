export type Bounty = {
  id: string;
  category: string;
  tag: string;
  title: string;
  description: string;
  reward: string;
  time: string;
  submissions: string;
  creator: string;
  winners?: number;
  distribution?: "equal" | "custom";
  percentages?: number[];
};

export const bounties: Bounty[] = [];
