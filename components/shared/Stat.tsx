import type { ReactNode } from "react";

type StatProps = {
  icon: ReactNode;
  label: string;
  value: number;
  tone: string;
};

export default function Stat({ icon, label, value, tone }: StatProps) {
  return (
    <div className="statCard">
      <div className={`statIcon ${tone}`}>
        {icon}
      </div>

      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
