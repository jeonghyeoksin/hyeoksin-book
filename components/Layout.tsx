import React from 'react';
import { 
  BookOpen, 
  PenTool, 
  Image as ImageIcon, 
  LayoutTemplate, 
  Download, 
  Lightbulb, 
  LayoutDashboard,
  Key
} from 'lucide-react';
import { AppStep } from '../types';

interface LayoutProps {
  currentStep: AppStep;
  children: React.ReactNode;
  setCurrentStep: (step: AppStep) => void;
  onSettingsOpen: () => void;
}

const steps = [
  { id: AppStep.DASHBOARD, label: '대시보드', icon: LayoutDashboard },
  { id: AppStep.TOPIC_SELECTION, label: '주제 선정', icon: Lightbulb },
  { id: AppStep.PLANNING, label: '기획 및 목차', icon: LayoutTemplate },
  { id: AppStep.WRITING, label: '원고 작성', icon: PenTool },
  { id: AppStep.COVER_DESIGN, label: '표지 생성', icon: BookOpen },
  { id: AppStep.ILLUSTRATION, label: '삽화 생성', icon: ImageIcon },
  { id: AppStep.REVIEW_DOWNLOAD, label: '최종 및 다운로드', icon: Download },
];

export const Layout: React.FC<LayoutProps> = ({ currentStep, children, setCurrentStep, onSettingsOpen }) => {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-10">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
              <BookOpen size={20} className="text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">혁신 전자책 AI</h1>
          </div>
          <p className="text-xs text-slate-400 mt-2">Gemini 3 Pro Powered</p>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {steps.map((step) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isPast = currentStep > step.id;
              
              return (
                <li key={step.id}>
                  <button
                    onClick={() => isPast || isActive ? setCurrentStep(step.id) : null}
                    disabled={!isPast && !isActive}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200
                      ${isActive 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : isPast 
                          ? 'text-slate-300 hover:bg-slate-800 cursor-pointer' 
                          : 'text-slate-500 cursor-not-allowed opacity-60'
                      }
                    `}
                  >
                    <Icon size={18} />
                    {step.label}
                    {isPast && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400"></div>}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-700 bg-slate-950 flex flex-col gap-2">
          <button 
            onClick={onSettingsOpen}
            className="w-full flex items-center gap-3 px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
          >
            <div className="p-1.5 bg-slate-800 rounded-md">
              <Key size={14} />
            </div>
            Gemini API 키 선택
          </button>
          <div className="flex items-center justify-between px-1">
            <div>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Developer</p>
              <p className="text-xs font-bold text-white">정혁신</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative">
        <div className="max-w-5xl mx-auto p-8 pb-20">
            {children}
        </div>
      </main>
    </div>
  );
};