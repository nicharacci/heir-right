const base = process.env.S46_SANDBOX_URL;
const token = process.env.S46_INTERNAL_API_TOKEN;
if (!base || !token) throw new Error("S46_SANDBOX_URL and S46_INTERNAL_API_TOKEN are required");
const headers = { authorization: `Bearer ${token}` };
const closing = await fetch(`${base}/s46/closing/runs`, { method: "POST", headers });
const idi = await fetch(`${base}/s46/discovery/idi-api/runs`, { method: "POST", headers });
if (closing.status !== 503 || idi.status !== 503) throw new Error("disabled_lane_gate_failed");
console.log(JSON.stringify({ sandbox: "s46-sandbox", closingDisabled: true, idiApiDisabled: true }));
