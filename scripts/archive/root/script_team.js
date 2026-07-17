const fs = require('fs');

const path = 'frontend/src/components/TeamManagementModal.jsx';
let content = fs.readFileSync(path, 'utf8');

const newFunc = `  const handleEditTeam = async (id, currentName) => {
    const { value: newName } = await Swal.fire({
      title: 'แก้ไขชื่อทีม',
      input: 'text',
      inputLabel: 'ชื่อทีมใหม่',
      inputValue: currentName,
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      inputValidator: (value) => {
        if (!value.trim()) {
          return 'กรุณากรอกชื่อทีม';
        }
        if (value.trim() === currentName) {
          return 'ชื่อทีมไม่มีการเปลี่ยนแปลง';
        }
      }
    });

    if (newName) {
      try {
        await api.put(\`/users/teams/\${id}\`, { team_name: newName.trim() });
        Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'แก้ไขชื่อทีมเรียบร้อยแล้ว', timer: 1500, showConfirmButton: false });
        fetchTeams();
        refreshParent();
      } catch (err) {
        Swal.fire('เกิดข้อผิดพลาด', err.response?.data?.error || 'ไม่สามารถแก้ไขชื่อทีมได้', 'error');
      }
    }
  };

  return (`;

content = content.replace(/  return \(/, newFunc);

const newButtons = `                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={() => handleEditTeam(team.id, team.team_name)}
                      className="p-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-500 transition-all"
                      title="แก้ไขชื่อทีม"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteTeam(team.id, team.team_name, team.member_count)}
                      disabled={deletingId === team.id || team.member_count > 0}
                      className="p-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title={team.member_count > 0 ? "ไม่สามารถลบทีมที่มีสมาชิกได้" : "ลบทีม"}
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>`;

const regex = /<button[\s\S]*?onClick=\{\(\) => handleDeleteTeam\([\s\S]*?<\/button>/;
content = content.replace(regex, newButtons);

fs.writeFileSync(path, content, 'utf8');
