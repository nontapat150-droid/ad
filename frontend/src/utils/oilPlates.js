/**
 * Build searchable license-plate options from teams in the system.
 * Prefer vehicle_plate; also include oil team names (historical oil records store team_name as plate).
 */
export function buildLicensePlateOptions(teams = [], currentPlate = '') {
  const map = new Map();

  for (const team of teams || []) {
    if (team.is_active === 0 || team.is_active === false) continue;

    const plate = String(team.vehicle_plate || '').trim();
    const teamName = String(team.team_name || '').trim();
    const typeLabel = String(team.type_label || '').trim();
    const isOilTeam = Number(team.counts_for_oil) === 1;

    if (plate) {
      if (!map.has(plate)) {
        map.set(plate, {
          value: plate,
          label: plate,
          sublabel: [teamName && teamName !== plate ? teamName : null, typeLabel].filter(Boolean).join(' · ') || 'ทะเบียนจากทีม',
          searchText: `${plate} ${teamName} ${typeLabel}`,
        });
      }
    }

    // Oil fill forms historically autofill team_name into license_plate
    if (teamName && (isOilTeam || !plate)) {
      if (!map.has(teamName)) {
        map.set(teamName, {
          value: teamName,
          label: teamName,
          sublabel: [
            plate && plate !== teamName ? `ทะเบียน ${plate}` : null,
            typeLabel || (isOilTeam ? 'ทีมน้ำมัน' : 'ทีม'),
          ].filter(Boolean).join(' · '),
          searchText: `${teamName} ${plate} ${typeLabel}`,
        });
      }
    }
  }

  const current = String(currentPlate || '').trim();
  if (current && !map.has(current)) {
    map.set(current, {
      value: current,
      label: current,
      sublabel: 'ค่าปัจจุบันในรายการ',
      searchText: current,
    });
  }

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'th'));
}
