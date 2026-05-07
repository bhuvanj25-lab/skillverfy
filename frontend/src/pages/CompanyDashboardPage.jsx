import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function CompanyDashboardPage() {
  const navigate = useNavigate();
  const [workers, setWorkers] = useState([]);
  const [unlockedIds, setUnlockedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unlockingId, setUnlockingId] = useState(null);

  const token = localStorage.getItem("companyToken");
  const company = JSON.parse(localStorage.getItem("companyInfo") || "{}");

  useEffect(() => {
    if (!token) { navigate("/company/login"); return; }
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const workersRes = await fetch("/api/admin/workers", {
        headers: { "x-admin-key": "public_verified_only" },
      });
      const workersData = await workersRes.json();
      setWorkers(workersData.workers?.filter((w) => w.verified) || []);

      const unlocksRes = await fetch("/api/company/unlocked-workers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const unlocksData = await unlocksRes.json();
      setUnlockedIds(unlocksData.unlockedWorkerIds || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadRazorpay = () =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve();
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = resolve;
      document.body.appendChild(script);
    });

  const handleUnlock = async (worker) => {
    setUnlockingId(worker.id);
    try {
      await loadRazorpay();

      const orderRes = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ workerId: worker.id }),
      });
      const order = await orderRes.json();
      if (!orderRes.ok) throw new Error(order.error);

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "SkillVerify",
        description: `Unlock contact: ${worker.name}`,
        order_id: order.orderId,
        handler: async (response) => {
          const verifyRes = await fetch("/api/payment/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ...response, workerId: worker.id }),
          });
          const result = await verifyRes.json();
          if (result.success) {
            setUnlockedIds((prev) => [...prev, worker.id]);
            alert(`✅ Contact unlocked!\nEmail: ${worker.email}\nPhone: ${worker.phone || "Not provided"}`);
          }
        },
        prefill: { email: company.email, name: company.name },
        theme: { color: "#1e293b" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      alert("Payment failed: " + err.message);
    } finally {
      setUnlockingId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("companyToken");
    localStorage.removeItem("companyInfo");
    navigate("/company/login");
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-500">Loading workers...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">SkillVerify</h1>
          <p className="text-slate-400 text-xs mt-0.5">Company Dashboard — {company.name}</p>
        </div>
        <button onClick={handleLogout} className="text-sm text-slate-400 hover:text-white transition">
          Logout
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 border border-slate-200 text-center">
            <p className="text-3xl font-bold text-slate-900">{workers.length}</p>
            <p className="text-sm text-slate-500 mt-1">Verified Workers</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-slate-200 text-center">
            <p className="text-3xl font-bold text-green-600">{unlockedIds.length}</p>
            <p className="text-sm text-slate-500 mt-1">Contacts Unlocked</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-slate-200 text-center">
            <p className="text-3xl font-bold text-slate-900">₹299</p>
            <p className="text-sm text-slate-500 mt-1">Per Unlock</p>
          </div>
        </div>

        <h2 className="text-xl font-semibold text-slate-900 mb-4">Verified Talent Pool</h2>

        {workers.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
            <p className="text-slate-500">No verified workers yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {workers.map((worker) => {
              const isUnlocked = unlockedIds.includes(worker.id);
              return (
                <div key={worker.id} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-lg">
                      {worker.name?.[0]?.toUpperCase() || "W"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{worker.name}</p>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ Verified</span>
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">{worker.skill || "General"}</p>
                      {isUnlocked && (
                        <div className="mt-1 flex items-center gap-3 text-sm text-slate-700">
                          <span>📧 {worker.email}</span>
                          {worker.phone && <span>📱 {worker.phone}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    {isUnlocked ? (
                      <span className="text-sm text-green-600 font-medium bg-green-50 px-3 py-1.5 rounded-lg">✅ Unlocked</span>
                    ) : (
                      <button onClick={() => handleUnlock(worker)} disabled={unlockingId === worker.id}
                        className="bg-slate-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-slate-700 transition disabled:opacity-50">
                        {unlockingId === worker.id ? "Processing..." : "Unlock ₹299"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}