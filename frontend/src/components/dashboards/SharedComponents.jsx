// ─── Shared Dashboard Components ────────────────────────────────────────────
// Palette: Charcoal #1F2937 · Lime #A3E635 · Soft Gray #F3F4F6

export function StatCard({ title, value, suffix, gradient, icon, shadow, urgent }) {
  return (
    <div className={`rounded-2xl overflow-hidden border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group cursor-default ${
      urgent ? 'border-red-300 bg-red-50' : 'border-[#E5E7EB] bg-white'
    }`}
      style={urgent ? {} : { boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      {/* Lime top accent bar */}
      <div className={`h-1 w-full ${urgent ? 'bg-red-400' : 'bg-gradient-to-r from-[#A3E635] to-[#65a30d]'}`} />
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-xl shadow-md ${shadow} mb-4 group-hover:scale-110 transition-transform duration-300`}>
            {icon}
          </div>
          {urgent && (
            <span className="text-[10px] font-bold text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded-lg animate-pulse">
              รอดำเนินการ
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-black text-[#1F2937]">{value}</span>
          <span className="text-sm font-medium text-[#6B7280]">{suffix}</span>
        </div>
        <p className="text-xs font-medium text-[#6B7280] mt-1 truncate">{title}</p>
      </div>
    </div>
  );
}

export function ShortcutBtn({ icon, label, sublabel, onClick, gradient, shadow }) {
  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br ${gradient} shadow-lg ${shadow} hover:shadow-xl hover:-translate-y-1 transition-all duration-300 active:scale-[0.97] group text-left w-full`}
    >
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/8 transition-colors" />
      <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center text-xl backdrop-blur-sm shrink-0 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-white font-bold text-sm leading-tight">{label}</div>
        {sublabel && <div className="text-white/60 text-xs truncate mt-0.5">{sublabel}</div>}
      </div>
    </button>
  );
}

export function ProgressCard({ title, icon, current, target, suffix, pct, gradient, trackColor, barColor }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-xl shadow-md`}>
            {icon}
          </div>
          <p className="text-sm font-bold text-[#1F2937]">{title}</p>
        </div>
        <div className="text-lg font-black text-[#A3E635]">{pct}%</div>
      </div>
      <div className="flex items-baseline gap-1 mb-3">
        <span className="text-3xl font-black text-[#1F2937]">{current}</span>
        <span className="text-sm text-[#6B7280]">/ {target} {suffix}</span>
      </div>
      <div className={`w-full ${trackColor} rounded-full h-2.5 overflow-hidden`}>
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-1000 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
