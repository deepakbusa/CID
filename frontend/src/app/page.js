"use client";
import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const initialForm = {
  revenue: '129.14',
  nps: '60',
  r_d_spend: '20.5',
  regions: '17',
  retention_rate: '85.0',
};

export default function Home() {
  const [form, setForm] = useState(initialForm);
  const [submitted, setSubmitted] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [competitors, setCompetitors] = useState([]);
  const [selectedCompetitorIdx, setSelectedCompetitorIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [insight, setInsight] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [scenario, setScenario] = useState("");
  const [simResult, setSimResult] = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState("");
  const [dataset, setDataset] = useState(null);
  const [datasetPreview, setDatasetPreview] = useState(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // Mock trend data for the chart
  const revenueTrends = [
    { month: "Jan", your_company: 6.5, competitor: 9.8 },
    { month: "Feb", your_company: 6.8, competitor: 10.0 },
    { month: "Mar", your_company: 7.0, competitor: 10.2 },
    { month: "Apr", your_company: 7.2, competitor: 10.5 },
    { month: "May", your_company: 7.5, competitor: 10.8 },
  ];

  // Helper for field validation
  const validateForm = () => {
    const errors = {};
    if (!form.revenue || isNaN(form.revenue) || Number(form.revenue) <= 0) errors.revenue = "Enter a valid revenue (in millions)";
    if (!form.nps || isNaN(form.nps) || Number(form.nps) < -100 || Number(form.nps) > 100) errors.nps = "NPS must be between -100 and 100";
    if (!form.r_d_spend || isNaN(form.r_d_spend) || Number(form.r_d_spend) < 0) errors.r_d_spend = "Enter a valid R&D spend (in millions)";
    if (!form.regions || isNaN(form.regions) || Number(form.regions) < 1) errors.regions = "Enter the number of regions (at least 1)";
    if (!form.retention_rate || isNaN(form.retention_rate) || Number(form.retention_rate) < 0 || Number(form.retention_rate) > 100) errors.retention_rate = "Retention rate must be 0-100%";
    if (!dataset) errors.dataset = "Please upload a competitor dataset (CSV)";
    return errors;
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleDataset = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setDataset(file);
    if (file.name.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target.result;
        const lines = text.split('\n').slice(0, 5);
        setDatasetPreview(lines);
      };
      reader.readAsText(file);
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        // Show preview as 'Excel file uploaded'
        setDatasetPreview(["Excel file uploaded: " + file.name]);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const errors = validateForm();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setLoading(true);
    let body = {
      your_company: {
        revenue: Number(form.revenue),
        nps: Number(form.nps),
        r_d_spend: Number(form.r_d_spend),
        regions: Number(form.regions),
        retention_rate: Number(form.retention_rate),
      },
    };
    if (dataset) {
      if (dataset.name.endsWith('.csv')) {
        const fileText = await dataset.text();
        body["dataset"] = fileText;
        body["dataset_filename"] = dataset.name;
      } else if (dataset.name.endsWith('.xlsx') || dataset.name.endsWith('.xls')) {
        const fileBuffer = await dataset.arrayBuffer();
        const fileB64 = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));
        body["dataset"] = fileB64;
        body["dataset_filename"] = dataset.name;
      }
    }
    fetch("http://127.0.0.1:8000/api/metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch metrics");
        return res.json();
      })
      .then((data) => {
        setMetrics({ your_company: data.your_company });
        setCompetitors(data.competitors || []);
        setSelectedCompetitorIdx(0);
        setLoading(false);
        setSubmitted(true);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  const fetchInsight = () => {
    setInsightLoading(true);
    setInsight(null);
    fetch("http://127.0.0.1:8000/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        your_company: metrics?.your_company,
        competitor: competitors[selectedCompetitorIdx],
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setInsight(data.insight);
        setInsightLoading(false);
      })
      .catch((err) => {
        setInsight(`[AI error: ${err.message}]`);
        setInsightLoading(false);
      });
  };


  useEffect(() => {
    if (metrics && competitors.length > 0) {
      fetchInsight();
    }

  }, [metrics, selectedCompetitorIdx]);


  const handleCompetitorChange = (e) => {
    setSelectedCompetitorIdx(Number(e.target.value));
    setSimResult(null);
  };

  const handleSimulate = (e) => {
    e.preventDefault();
    setSimLoading(true);
    setSimError("");
    setSimResult(null);
    fetch("http://127.0.0.1:8000/api/simulation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...metrics,
        competitor: competitors[selectedCompetitorIdx],
        scenario,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Simulation failed");
        return res.json();
      })
      .then((data) => {
        setSimResult(data);
        setSimLoading(false);
      })
      .catch((err) => {
        setSimError(err.message);
        setSimLoading(false);
      });
  };


  if (!submitted) {
  return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow w-full max-w-lg space-y-6">
          <h2 className="text-2xl font-bold mb-2 text-center">Enter Your Company Details</h2>
          <button
            type="button"
            className="text-blue-600 underline text-sm mb-2"
            onClick={() => setShowHowItWorks((v) => !v)}
          >
            {showHowItWorks ? "Hide" : "How does this work?"}
          </button>
          {showHowItWorks && (
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded mb-4 text-sm text-gray-700">
              <b>How it works:</b>
              <ul className="list-disc ml-5 mt-1">
                <li>Enter your company's key metrics. This helps us compare you accurately to your competitors.</li>
                <li>Upload a CSV file with your competitors' data. We'll extract all competitors from your file and let you pick which one to compare against.</li>
                <li>After submitting, you'll see a dashboard with side-by-side comparison, AI insights, and growth recommendations.</li>
                <li>All analysis is powered by Azure OpenAI GPT-4o for strategic, actionable results.</li>
              </ul>
            </div>
          )}
          {error && <div className="text-red-600 mb-2">{error}</div>}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block font-medium">Revenue (in millions)</label>
              <input name="revenue" type="number" step="0.01" min="0" placeholder="e.g. 12.5" value={form.revenue} onChange={handleChange} className="border rounded px-3 py-2 w-full" required />
              {formErrors.revenue && <div className="text-xs text-red-500 mt-1">{formErrors.revenue}</div>}
            </div>
            <div>
              <label className="block font-medium">NPS</label>
              <input name="nps" type="number" step="1" min="-100" max="100" placeholder="e.g. 48" value={form.nps} onChange={handleChange} className="border rounded px-3 py-2 w-full" required />
              <div className="text-xs text-gray-500">Net Promoter Score (-100 to 100)</div>
              {formErrors.nps && <div className="text-xs text-red-500 mt-1">{formErrors.nps}</div>}
            </div>
            <div>
              <label className="block font-medium">R&D Spend (in millions)</label>
              <input name="r_d_spend" type="number" step="0.01" min="0" placeholder="e.g. 5.2" value={form.r_d_spend} onChange={handleChange} className="border rounded px-3 py-2 w-full" required />
              {formErrors.r_d_spend && <div className="text-xs text-red-500 mt-1">{formErrors.r_d_spend}</div>}
            </div>
            <div>
              <label className="block font-medium">Regions</label>
              <input name="regions" type="number" step="1" min="1" placeholder="e.g. 3" value={form.regions} onChange={handleChange} className="border rounded px-3 py-2 w-full" required />
              {formErrors.regions && <div className="text-xs text-red-500 mt-1">{formErrors.regions}</div>}
            </div>
            <div>
              <label className="block font-medium">Retention Rate (%)</label>
              <input name="retention_rate" type="number" step="0.1" min="0" max="100" placeholder="e.g. 82" value={form.retention_rate} onChange={handleChange} className="border rounded px-3 py-2 w-full" required />
              {formErrors.retention_rate && <div className="text-xs text-red-500 mt-1">{formErrors.retention_rate}</div>}
            </div>
            <div>
              <label className="block mb-1 font-medium">Upload Dataset (CSV, XLSX, XLS)</label>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleDataset} className="border rounded px-3 py-2 w-full" required />
              <div className="text-xs text-gray-500">Your file should contain one row per competitor.</div>
              {datasetPreview && (
                <div className="mt-2 text-xs text-gray-500">
                  <div className="font-semibold">Preview:</div>
                  <pre className="bg-gray-100 rounded p-2 overflow-x-auto">{datasetPreview.join('\n')}</pre>
                </div>
              )}
              {formErrors.dataset && <div className="text-xs text-red-500 mt-1">{formErrors.dataset}</div>}
            </div>
          </div>
          <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition" disabled={loading}>
            {loading ? "Loading..." : "Submit & Analyze"}
          </button>
        </form>
      </div>
    );
  }

  if (!metrics || competitors.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="text-xl text-gray-500">Loading dashboard...</span>
      </div>
    );
  }

  const { your_company } = metrics;
  const competitor = competitors[selectedCompetitorIdx];

  const insightText = typeof insight === 'string' ? insight : insight?.insight;
  const hasInsight = insightText && insightText.trim().length > 0;
  const hasRecs = insight?.recommendations && insight.recommendations.length > 0;
  const hasWeak = insight?.weaknesses && insight.weaknesses.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Competitive Intelligence Engine</h1>
        <p className="text-gray-600">Compare your company to competitors and get real-time AI insights for growth and strategy.</p>
      </header>

      {/* Competitor Selection */}
      <section className="mb-8">
        <div className="mb-2 text-gray-700">
          We've extracted the following competitors from your dataset. Please select the one you want to compare against.
        </div>
        <label className="block mb-2 font-semibold">Select Competitor:</label>
        <select
          className="border rounded px-3 py-2"
          value={selectedCompetitorIdx}
          onChange={handleCompetitorChange}
        >
          {competitors.map((c, idx) => (
            <option key={idx} value={idx}>
              {c.name || c.Company || c.company || `Competitor ${idx + 1}`}
            </option>
          ))}
        </select>
      </section>

      {/* Executive Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
          <span className="text-lg font-semibold text-gray-700">Revenue</span>
          <span className="text-2xl font-bold text-blue-600">${your_company.revenue}M</span>
        </div>
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
          <span className="text-lg font-semibold text-gray-700">NPS</span>
          <span className="text-2xl font-bold text-green-600">{your_company.nps}</span>
        </div>
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
          <span className="text-lg font-semibold text-gray-700">Market Share</span>
          <span className="text-2xl font-bold text-purple-600">-</span>
        </div>
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
          <span className="text-lg font-semibold text-gray-700">R&D Spend</span>
          <span className="text-2xl font-bold text-yellow-600">${your_company.r_d_spend}M</span>
        </div>
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
          <span className="text-lg font-semibold text-gray-700">Customer Count</span>
          <span className="text-2xl font-bold text-pink-600">-</span>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">KPI Comparison</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="py-2 px-4 font-bold">KPI</th>
                <th className="py-2 px-4 font-bold">Your Company</th>
                <th className="py-2 px-4 font-bold">Competitor</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-2 px-4">Revenue</td>
                <td className="py-2 px-4">${your_company.revenue}M</td>
                <td className="py-2 px-4">${competitor.revenue}M</td>
              </tr>
              <tr>
                <td className="py-2 px-4">NPS</td>
                <td className="py-2 px-4">{your_company.nps}</td>
                <td className="py-2 px-4">{competitor.nps}</td>
              </tr>
              <tr>
                <td className="py-2 px-4">R&D Spend</td>
                <td className="py-2 px-4">${your_company.r_d_spend}M</td>
                <td className="py-2 px-4">${competitor.r_d_spend}M</td>
              </tr>
              <tr>
                <td className="py-2 px-4">Regions</td>
                <td className="py-2 px-4">{your_company.regions}</td>
                <td className="py-2 px-4">{competitor.regions}</td>
              </tr>
              <tr>
                <td className="py-2 px-4">Retention Rate</td>
                <td className="py-2 px-4">{your_company.retention_rate}%</td>
                <td className="py-2 px-4">{competitor.retention_rate}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Growth Gap Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-xl">
          <div className="font-bold text-red-700 mb-1">Revenue Gap</div>
          <div className="text-red-600">You are <b>{Math.round(((competitor.revenue - your_company.revenue) / competitor.revenue) * 100)}% behind</b> competitor. <span className="italic">Focus on new market expansion.</span></div>
        </div>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-xl">
          <div className="font-bold text-yellow-700 mb-1">NPS Gap</div>
          <div className="text-yellow-600">You are <b>{Math.round(((competitor.nps - your_company.nps) / competitor.nps) * 100)}% behind</b> competitor. <span className="italic">Improve customer support and product UX.</span></div>
        </div>
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-xl">
          <div className="font-bold text-blue-700 mb-1">Retention Gap</div>
          <div className="text-blue-600">You are <b>{Math.round(((competitor.retention_rate - your_company.retention_rate) / competitor.retention_rate) * 100)}% behind</b> competitor. <span className="italic">Launch loyalty programs.</span></div>
        </div>
      </section>

      {/* Smart Charts Section */}
      <section className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Smart Charts</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueTrends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis unit="M" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="your_company" name="Your Company" stroke="#2563eb" strokeWidth={3} />
              <Line type="monotone" dataKey="competitor" name="Competitor" stroke="#a21caf" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* AI Insight Section */}
      <section className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">AI Insights</h2>
        <div className="mb-4 text-gray-900 font-medium min-h-[48px]">
          {insightLoading ? (
            <span className="text-gray-500">Loading AI insight...</span>
          ) : (
            <>
              {(!hasInsight && !hasRecs && !hasWeak) ? (
                <span className="text-gray-400">No AI insight available. Try refreshing or check your backend logs.</span>
              ) : (
                <>
                  {hasInsight && <div className="mb-2">{insightText}</div>}
                  {hasRecs && (
                    <div className="mb-2">
                      <div className="font-semibold mb-1">Recommendations:</div>
                      <ul className="list-disc list-inside text-gray-700">
                        {insight.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                      </ul>
                    </div>
                  )}
                  {hasWeak && (
                    <div>
                      <div className="font-semibold mb-1">Weaknesses:</div>
                      <ul className="list-disc list-inside text-gray-700">
                        {insight.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition mb-4"
          onClick={fetchInsight}
          disabled={insightLoading}
        >
          {insightLoading ? "Refreshing..." : "Refresh Insight"}
        </button>
      </section>

      {/* What-If Scenario Section */}
      <section className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">What-If Scenario</h2>
        <form onSubmit={handleSimulate} className="flex flex-col md:flex-row gap-4 items-start md:items-end">
          <input
            type="text"
            className="border border-gray-300 rounded px-3 py-2 w-full md:w-1/2"
            placeholder="e.g. Increase R&D by 10%"
            value={scenario}
            onChange={e => setScenario(e.target.value)}
            required
          />
          <button
            type="submit"
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
            disabled={simLoading}
          >
            {simLoading ? "Simulating..." : "Run Simulation"}
          </button>
        </form>
        {simLoading && <div className="mt-4 text-gray-500">Running simulation...</div>}
        {simError && <div className="mt-4 text-red-600">{simError}</div>}
        {simResult && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">Simulation Result</h3>
            <div className="mb-2 text-gray-700">{simResult.commentary || "[AI commentary will appear here]"}</div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="py-2 px-4 font-bold">KPI</th>
                    <th className="py-2 px-4 font-bold">Your Company (Simulated)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-2 px-4">Revenue</td>
                    <td className="py-2 px-4">${simResult.your_company?.revenue ?? "-"}M</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4">NPS</td>
                    <td className="py-2 px-4">{simResult.your_company?.nps ?? "-"}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4">R&D Spend</td>
                    <td className="py-2 px-4">${simResult.your_company?.r_d_spend ?? "-"}M</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4">Regions</td>
                    <td className="py-2 px-4">{simResult.your_company?.regions ?? "-"}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4">Retention Rate</td>
                    <td className="py-2 px-4">{simResult.your_company?.retention_rate ?? "-"}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
