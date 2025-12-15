import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const data = [
  { name: "Jan", value1: 400, value2: 240 },
  { name: "Feb", value1: 300, value2: 139 },
  { name: "Mar", value1: 200, value2: 980 },
  { name: "Apr", value1: 278, value2: 390 },
  { name: "May", value1: 189, value2: 480 },
  { name: "Jun", value1: 239, value2: 380 },
];

export default function App() {
  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h1>Chart Widget Demo</h1>
      <p>Simple recharts test</p>

      <div style={{ width: "100%", height: 400, border: "1px solid #ccc", padding: 10 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="value1" stroke="#8884d8" />
            <Line type="monotone" dataKey="value2" stroke="#82ca9d" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <h2 style={{ marginTop: 20 }}>Data:</h2>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
