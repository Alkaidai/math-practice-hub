import { useState, useEffect } from 'react';
import { getTopics } from '../../lib/storage';
import { getTopicPrerequisites, addTopicPrerequisite, removeTopicPrerequisite } from '../../lib/adaptive';
import type { Topic } from '../../lib/types';
import { Link2, Trash2, Plus } from 'lucide-react';

interface PrereqRow {
  topicId: string;
  topicName: string;
  prerequisiteTopicId: string;
  prerequisiteTopicName: string;
}

export function AdminPrerequisites() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [prereqs, setPrereqs] = useState<PrereqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTopicId, setNewTopicId] = useState('');
  const [newPrereqId, setNewPrereqId] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [t, p] = await Promise.all([getTopics(), getTopicPrerequisites()]);
    setTopics(t);
    const tMap = new Map(t.map(x => [x.id, x.name]));
    setPrereqs(p.map(r => ({
      topicId: r.topicId,
      topicName: tMap.get(r.topicId) ?? r.topicId,
      prerequisiteTopicId: r.prerequisiteTopicId,
      prerequisiteTopicName: tMap.get(r.prerequisiteTopicId) ?? r.prerequisiteTopicId,
    })));
    setLoading(false);
  }

  async function handleAdd() {
    if (!newTopicId || !newPrereqId || newTopicId === newPrereqId) return;
    await addTopicPrerequisite(newTopicId, newPrereqId);
    setNewTopicId('');
    setNewPrereqId('');
    await load();
  }

  async function handleRemove(topicId: string, prereqId: string) {
    await removeTopicPrerequisite(topicId, prereqId);
    await load();
  }

  if (loading) return <p className="font-body text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-sm font-bold uppercase">🔗 Pré-requisitos entre Tópicos</h2>
      <p className="text-xs text-muted-foreground">
        Defina quais tópicos são pré-requisitos de outros. Quando um aluno travar em um tópico, o sistema sugerirá revisar o pré-requisito.
      </p>

      {/* Add form */}
      <div className="bg-card rounded-xl shadow-sm p-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase">Adicionar pré-requisito</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Tópico</label>
            <select value={newTopicId} onChange={e => setNewTopicId(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
              <option value="">Selecione o tópico...</option>
              {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Pré-requisito</label>
            <select value={newPrereqId} onChange={e => setNewPrereqId(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
              <option value="">Selecione o pré-requisito...</option>
              {topics.filter(t => t.id !== newTopicId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={handleAdd} disabled={!newTopicId || !newPrereqId}
              className="rounded-lg bg-primary text-primary-foreground font-semibold text-sm px-5 py-2 hover:brightness-110 transition-all disabled:opacity-40 flex items-center gap-1">
              <Plus className="h-4 w-4" /> Adicionar
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      {prereqs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum pré-requisito cadastrado.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-muted">
              <tr>
                {['Tópico', '', 'Pré-requisito', 'Ação'].map(h => (
                  <th key={h} className="font-heading text-xs text-left p-2 border border-border font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prereqs.map((p, i) => (
                <tr key={i} className="hover:bg-muted/50">
                  <td className="p-2 border border-border text-xs font-medium">{p.topicName}</td>
                  <td className="p-2 border border-border text-center"><Link2 className="h-3.5 w-3.5 text-muted-foreground mx-auto" /></td>
                  <td className="p-2 border border-border text-xs font-medium">{p.prerequisiteTopicName}</td>
                  <td className="p-2 border border-border">
                    <button onClick={() => handleRemove(p.topicId, p.prerequisiteTopicId)}
                      className="text-destructive hover:text-destructive/80 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
