import {BookOpen, CalendarDays, Users, Wallet, Settings, ShieldCheck} from 'lucide-react';
import {translator, type Language} from '../../../shared/i18n/index';
import type {WorkspaceView} from '../model/types';

interface WorkspaceNavigationProps {
 view: WorkspaceView;
 language: Language;
 name: string;
 studentCount: number;
 onNavigate: (view: WorkspaceView) => void;
}

/** Desktop sidebar and mobile bottom menu share the same navigation state. */
export function WorkspaceNavigation({view, language, name, studentCount, onNavigate}: WorkspaceNavigationProps) {
 const t = translator(language);
 return <aside className="sidebar"><div className="brand"><BookOpen /> Lessavio<span>web</span></div><p className="nav-caption">{t("РАБОЧЕЕ ПРОСТРАНСТВО")}</p><nav aria-label={t("РАБОЧЕЕ ПРОСТРАНСТВО")}>{([['today', t("Сегодня"), BookOpen], ['calendar', t("Календарь"), CalendarDays], ['students', t("Ученики"), Users], ['finance',t('Финансы'),Wallet], ['settings', t("Настройки"), Settings]] as const).map(([id, label, Icon]) => <button key={id} aria-current={view === id ? 'page' : undefined} className={view === id ? 'active' : ''} onClick={() => onNavigate(id)}><Icon size={19}/>{label}{id === 'students' && <span className="nav-count">{studentCount}</span>}</button>)}</nav><div className="local-note"><ShieldCheck size={19}/><strong>{t("Только на вашем устройстве")}</strong><p>{t("Ваши данные принадлежат вам.")}<br />{t("Интернет не требуется.")}</p></div><div className="user"><div className="avatar">{name.slice(0, 1).toUpperCase()}</div><div><strong>{name}</strong><small>{t("Личный профиль")}</small></div><button aria-label={t("Настройки")} onClick={() => onNavigate('settings')}><Settings size={17}/></button></div></aside>;
}
