import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StudentOption {
  id: string;
  username: string;
  name: string;
}

export function useStudentList() {
  const [students, setStudents] = useState<StudentOption[]>([]);
  useEffect(() => {
    supabase.from('profiles').select('id, username, name').eq('role', 'student').eq('status', 'active').order('username')
      .then(({ data }) => {
        setStudents((data ?? []).map((r: any) => ({ id: r.id, username: r.username, name: r.name })));
      });
  }, []);
  return students;
}

export function StudentSelector({ students, value, onChange }: {
  students: StudentOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Aluno:</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-xs border border-border rounded px-2 py-1.5 bg-background text-foreground max-w-[220px]"
      >
        <option value="">Todos os alunos</option>
        {students.map(s => (
          <option key={s.id} value={s.username}>{s.username} — {s.name}</option>
        ))}
      </select>
    </div>
  );
}
