import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
const Chart = dynamic(() => import("./Chart"), { ssr: false });

export default function Page() {
  const [form, setForm] = useState({
    name: "Acme Corp",
    industry: "SaaS",
    region: "North America",
    revenue: 7.5,
    nps: 48,
    r_d_spend: 12,
    regions: 3,
    retention_rate: 82,
  });
  const [dataset, setDataset] = useState("");
  const [datasetFilename, setDatasetFilename] = useState("");
  const [competitors, setCompetitors] = useState([]);
  const [selectedCompetitor, setSelectedCompetitor] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [insight, setInsight] = useState(null);
  const [scenario, setScenario] = useState("");
  const [simulation, setSimulation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [trendData, setTrendData] = useState([
    { name: "Q1", you: 7.5, competitor: 10.8 },
    { name: "Q2", you: 8.2, competitor: 11.1 },
    { name: "Q3", you: 8.7, competitor: 11.5 },
    { name: "Q4", you: 9.1, competitor: 12.0 },
  ]);

  function validateField(field, value) {
    if (field === "name" && !value) return "Company name is required.";
    if (field === "revenue" && (isNaN(value) || value < 0)) return "Revenue must be a positive number.";
    return "";
  }

  function handleInput(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleDataset(e) {
    const file = e.target.files[0];
    if (!file) return;
    setDatasetFilename(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      setDataset(evt.target.result);
    };
    reader.readAsText(file);
  }

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
    setLoading(true);
    setError("");
    fetch("/api/metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ your_company: form, dataset, dataset_filename: datasetFilename }),
    })
      .then((res) => res.json())
      .then((data) => {
        setMetrics(data);
        setCompetitors(data.competitors || []);
        setSelectedCompetitor(data.competitors?.[0] || null);
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to fetch metrics.");
        setLoading(false);
      });
  }

  useEffect(() => {
    if (!submitted) return;
    if (!metrics || !selectedCompetitor) return;
    setLoading(true);
    setError("");
    fetch("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ your_company: form, competitor: selectedCompetitor }),
    })
      .then((res) => res.json())
      .then((data) => {
        setInsight(data);
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to fetch insight.");
        setLoading(false);
      });
    // eslint-disable-next-line
  }, [metrics, selectedCompetitor]);

  function handleCompetitor(e) {
    const idx = e.target.value;
    setSelectedCompetitor(competitors[idx]);
  }

  function handleSimulation(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    fetch("/api/simulation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ your_company: form, competitor: selectedCompetitor, scenario }),
    })
      .then((res) => res.json())
      .then((data) => {
        setSimulation(data);
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to run simulation.");
        setLoading(false);
      });
  }

  if (!submitted) {
    return (
      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl mx-auto mt-8 p-6 bg-white rounded shadow">
        <h2 className="text-2xl font-bold mb-2">Your Company Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Name</label>
            <input name="name" value={form.name} onChange={handleInput} className="border rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium">Industry</label>
            <input name="industry" value={form.industry} onChange={handleInput} className="border rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium">Region</label>
            <input name="region" value={form.region} onChange={handleInput} className="border rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium">Revenue ($M)</label>
            <input name="revenue" value={form.revenue} onChange={handleInput} className="border rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium">NPS</label>
            <input name="nps" value={form.nps} onChange={handleInput} className="border rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium">R&D Spend ($M)</label>
            <input name="r_d_spend" value={form.r_d_spend} onChange={handleInput} className="border rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium">Regions</label>
            <input name="regions" value={form.regions} onChange={handleInput} className="border rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium">Retention Rate (%)</label>
            <input name="retention_rate" value={form.retention_rate} onChange={handleInput} className="border rounded px-2 py-1 w-full" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium">Competitor Dataset (CSV/Excel)</label>
          <input type="file" accept=".csv,.xlsx,.xls" onChange={handleDataset} className="mt-1" />
          {datasetFilename && <div className="text-xs text-gray-500 mt-1">{datasetFilename.endsWith(".csv") ? "CSV file uploaded" : "Excel file uploaded"}</div>}
        </div>
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Submit</button>
        {error && <div className="text-red-600 mt-2">{error}</div>}
      </form>
    );
  }

  return (
    <div className="max-w-5xl mx-auto mt-8 p-6 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Competitive Intelligence Dashboard</h2>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-100 p-4 rounded">
          <h3 className="font-semibold mb-2">Your Company</h3>
          <pre className="text-xs">{JSON.stringify(form, null, 2)}</pre>
        </div>
        <div className="bg-gray-100 p-4 rounded">
          <h3 className="font-semibold mb-2">Competitor</h3>
          <select value={competitors.indexOf(selectedCompetitor)} onChange={handleCompetitor} className="border rounded px-2 py-1 w-full mb-2">
            {competitors.map((c, i) => (
              <option key={i} value={i}>{c.name || `Competitor ${i + 1}`}</option>
            ))}
          </select>
          {selectedCompetitor && <pre className="text-xs">{JSON.stringify(selectedCompetitor, null, 2)}</pre>}
        </div>
      </div>
      <div className="mb-6">
        <Chart data={trendData} />
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded">
          <div className="font-bold text-lg">${form.revenue}M</div>
          <div className="text-xs text-gray-600">Your Revenue</div>
        </div>
        <div className="bg-green-50 p-4 rounded">
          <div className="font-bold text-lg">{selectedCompetitor?.revenue}M</div>
          <div className="text-xs text-gray-600">Competitor Revenue</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded">
          <div className="font-bold text-lg">{form.nps}</div>
          <div className="text-xs text-gray-600">Your NPS</div>
        </div>
      </div>
      <div className="mb-6">
        <h3 className="font-semibold mb-2">AI Insights</h3>
        {loading ? (
          <div>Loading insight...</div>
        ) : insight ? (
          <div>
            <div className="mb-2"><strong>Insight:</strong> {insight.insight}</div>
            <div className="mb-2"><strong>Recommendations:</strong>
              <ul className="list-disc ml-6">
                {insight.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
            <div className="mb-2"><strong>Weaknesses:</strong>
              <ul className="list-disc ml-6">
                {insight.weaknesses.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : null}
      </div>
      <form onSubmit={handleSimulation} className="mb-6">
        <label className="block text-sm font-medium">What-If Scenario</label>
        <input value={scenario} onChange={e => setScenario(e.target.value)} className="border rounded px-2 py-1 w-full mb-2" placeholder="E.g. Increase R&D by 10%" />
        <button type="submit" className="bg-purple-600 text-white px-4 py-2 rounded">Simulate</button>
      </form>
      {simulation && (
        <div className="bg-gray-50 p-4 rounded">
          <div className="font-semibold mb-2">Simulation Result</div>
          <pre className="text-xs">{JSON.stringify(simulation, null, 2)}</pre>
        </div>
      )}
      <button onClick={() => window.location.reload()} className="mt-6 bg-gray-300 px-4 py-2 rounded">Start Over</button>
    </div>
  );
}
