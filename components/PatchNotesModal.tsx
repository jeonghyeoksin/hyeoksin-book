import React from 'react';
import { X, ClipboardList, Zap, CheckCircle2, Calendar } from 'lucide-react';

interface PatchNote {
  date: string;
  version: string;
  changes: string[];
}

const patchNotes: PatchNote[] = [
  {
    date: '2026-04-19',
    version: 'v1.4.0',
    changes: [
      '패치노트 카테고리 추가 (업데이트 내역 실시간 확인 가능)',
      'API 비용 안내 고도화 (최소/최대 비용 범위 및 원화 표시 강화)',
      '전자책 분량 및 사례별 정밀 비용 시뮬레이션 데이터 업데이트'
    ]
  },
  {
    date: '2026-04-03',
    version: 'v1.3.5',
    changes: [
      '주제 선정 단계 내 "삽화 이미지 생성" 선택 토글 추가',
      '이미지 생성 시 API 비용 과다 소모 주의 문구 삽입',
      '삽화 비활성화 시 자동화 프로세스 최적화 (단계 건너뛰기 기능)',
      '이미지 생성 서버 부하(503) 시 자동 재시도 로직 강화'
    ]
  },
  {
    date: '2026-04-01',
    version: 'v1.3.0',
    changes: [
      '표지 저자명 삽입 강제화 - 하단 중앙 "[저자명] 지음" 고정',
      '저자명 미입력 시 "혁신 AI 저자" 기본값 자동 설정',
      '표지 내 불필요한 영문 텍스트 및 타겟 정보 배제 로직 강화'
    ]
  },
  {
    date: '2026-03-31',
    version: 'v1.2.0',
    changes: [
      'API 비용 안내 카테고리 신설 (우측 상단)',
      '본문 가독성 최적화 - 두 문단마다 한 줄의 빈 줄 자동 삽입',
      'AI 독자 설정 기능 추가 - 주제 분석을 통한 최적의 페르소나 제안'
    ]
  },
  {
    date: '2026-03-29',
    version: 'v1.1.0',
    changes: [
      '참고자료 첨부 제한 해제 (무제한 첨부 가능)',
      'DOCX, PDF 문서 파일 분석 지원 시작',
      '원클릭 자동화 고도화 - 주제 선정부터 다운로드까지 전 과정 100% 자동화',
      '사용 방법(How to Use) 가이드 전면 개편'
    ]
  },
  {
    date: '2026-03-20',
    version: 'v1.0.0',
    changes: [
      '혁신 전자책 AI 서비스 런칭',
      'Gemini 3.1 Pro 기반 고성능 원고 집필 엔진 탑재',
      'DALL-E급 표지 및 챕터별 삽화 생성 기능 구현'
    ]
  }
];

interface PatchNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PatchNotesModal: React.FC<PatchNotesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500 rounded-xl">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">시스템 패치노트</h2>
              <p className="text-slate-400 text-sm">혁신 전자책 AI의 역사와 업데이트 내역</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto space-y-8 bg-slate-50">
          <div className="space-y-6">
            {patchNotes.map((note, idx) => (
              <div key={idx} className="relative pl-8 border-l-2 border-slate-200 pb-2 last:pb-0">
                {/* Timeline Dot */}
                <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm ${idx === 0 ? 'bg-indigo-600 scale-125' : 'bg-slate-300'}`}></div>
                
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${idx === 0 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {idx === 0 ? 'Latest' : note.version}
                  </span>
                  <div className="flex items-center gap-1 text-slate-400 text-xs font-medium">
                    <Calendar size={12} />
                    {note.date}
                  </div>
                </div>

                <div className={`p-4 rounded-2xl border ${idx === 0 ? 'bg-white border-indigo-200 shadow-md' : 'bg-slate-50 border-slate-200'}`}>
                  <ul className="space-y-2">
                    {note.changes.map((change, cIdx) => (
                      <li key={cIdx} className="flex items-start gap-2 text-sm text-slate-700 leading-relaxed">
                        <CheckCircle2 size={14} className={`mt-0.5 shrink-0 ${idx === 0 ? 'text-indigo-600' : 'text-slate-400'}`} />
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-3">
            <Zap className="text-indigo-600 w-5 h-5 shrink-0" />
            <p className="text-xs text-indigo-800 font-medium leading-relaxed">
              혁신 전자책 AI는 사용자의 피드백을 실시간으로 반영하여 매주 성능을 업데이트하고 있습니다. 오류 제보 및 기능 제안은 하단 메일로 부탁드립니다.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 bg-white border-t border-slate-200 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all active:scale-95"
          >
            확인 및 닫기
          </button>
        </div>
      </div>
    </div>
  );
};
