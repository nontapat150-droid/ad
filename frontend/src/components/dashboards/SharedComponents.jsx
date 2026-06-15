export function StatCard({ title, value, suffix, gradient, icon, shadow, urgent }) {
  return (
    <div className={`glass rounded-2xl overflow-hidden border ${urgent ? 'border-rose-200 animate-pulse-slow' : 'border-white/50'} hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group`}>
      <div className={`h-1.5 w-full bg-gradient-to-r ${gradient}`} />
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-2xl shadow-lg ${shadow} mb-4 group-hover:scale-110 transition-transform duration-300`}>
            {icon}
          </div>
          {urgent && (
            <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg animate-pulse">
              รอดำเนินการ
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-black text-[#042C53]">{value}</span>
          <span className="text-sm font-medium text-[#378ADD]">{suffix}</span>
        </div>
        <p className="text-xs font-medium text-[#378ADD] mt-1 truncate">{title}</p>
      </div>
    </div>
  );
}

export function ShortcutBtn({ icon, label, sublabel, onClick, gradient, shadow }) {
  return (
    <button onClick={onClick}
      className={`relative overflow-hidden flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br ${gradient} shadow-lg ${shadow} hover:shadow-xl hover:-translate-y-1 transition-all duration-300 active:scale-[0.97] group text-left w-full`}>
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors" />
      <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center text-xl backdrop-blur-sm shrink-0 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-white font-bold text-sm leading-tight">{label}</div>
        {sublabel && <div className="text-white/60 text-xs truncate">{sublabel}</div>}
      </div>
    </button>
  );
}

export function ProgressCard({ title, icon, current, target, suffix, pct, gradient, trackColor, barColor }) {
  return (
    <div className="glass rounded-2xl p-5 border border-white/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-xl shadow-md`}>
            {icon}
          </div>
          <p className="text-sm font-bold text-[#042C53]">{title}</p>
        </div>
        <div className={`text-lg font-black bg-gradient-to-br ${gradient} bg-clip-text text-transparent`}>
          {pct}%
        </div>
      </div>
      <div className="flex items-baseline gap-1 mb-3">
        <span className="text-3xl font-black text-[#042C53]">{current}</span>
        <span className="text-sm text-[#378ADD]">/ {target} {suffix}</span>
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
