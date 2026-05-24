import React from 'react';
import { X, ClipboardList, Zap, CheckCircle2, Calendar } from 'lucide-react';

interface PatchNote {
  date: string;
  version: string;
  changes: string[];
}

const patchNotes: PatchNote[] = [
  {
    date: 'Upcoming',
    version: 'Next',
    changes: [
      '사용자 맞춤형 전자책 템플릿 저장 기능 지원 예정',
      '다양한 추출 포맷(EPUB, Markdown) 추가 지원',
      '에디터 내 실시간 자동 저장 및 히스토리 복원 기능'
    ]
  },
  {
    date: '2026-05-24',
    version: 'v1.5.0',
    changes: [
      '이미지 생성 모델 장애/과부하 발생 시, 고화질 보조 이미징 모델들(Imagen 3, Gemini 3.1, Gemini 2.5)로 순차적 자동 전환(Fallback Queue)하여 503 오류를 완전 차단하고 무중단 표지/삽화 생성을 보장하는 지능형 대체 인프라 도입'
    ]
  },
  {
    date: '2026-05-12',
    version: 'v1.4.10',
    changes: [
      '전자책 표지 이미지 생성 시, 지정된 전자책 제목과 저자 텍스트가 강제로 포함되도록 AI 이미지 프롬프트 최적화 적용'
    ]
  },
  {
    date: '2026-05-12',
    version: 'v1.4.9',
    changes: [
      '전자책 문서 다운로드(Word) 시 마지막 페이지에 포함된 AI 활용 관련 면책 조항 삭제 및 저작권 강화 문구 추가'
    ]
  },
  {
    date: '2026-05-12',
    version: 'v1.4.8',
    changes: [
      '로컬 환경(브라우저)에서 페이지 새로고침 시 이전에 작성 중이던 모든 내용을 자동 변환 및 복구하는 로컬 자동 저장 기능 추가',
      '문서 진행 상황을 초기화할 수 있는 "새로 만들기" 버튼 상단 바에 추가'
    ]
  },
  {
    date: '2026-05-12',
    version: 'v1.4.7',
    changes: [
      '나노바나나 2 모델을 활용하여 표지 생성 시 저자와 제목이 한국어 텍스트로 이미지에 직접 포함되도록 수정'
    ]
  },
  {
    date: '2026-05-12',
    version: 'v1.4.6',
    changes: [
      '주제 선정 이후 후킹성 있고 매력적인 제목을 AI가 추천해 주는 "제목 설정" 단계 추가',
      'AI가 생성하는 본문에서 "혁신 전자책 AI" 관련 문구가 포함되지 않도록 기준 보강',
      '전자책 추출(DOCX) 시 후면 마지막 페이지에 저작권 및 면책 조항 자동 포함 기능 추가',
    ]
  },
  {
    date: '2026-05-12',
    version: 'v1.4.5',
    changes: [
      '고퀄리티 전자책 생성을 위한 "원하는 형식/스타일" 및 "저자의 전문성/배경" 입력 옵션 추가',
      '전자책 본문에서 내용을 효과적으로 강조할 수 있도록 텍스트 하이라이팅 기능 추가(빨간색, 파란색, 초록색 텍스트 및 노란 배경 적용 지원)'
    ]
  },
  {
    date: '2026-05-11',
    version: 'v1.4.4',
    changes: [
      '구글 AI 서비스 과부하(503 에러) 발생 시 사용자가 이를 인지할 수 있도록 에러 메시지 처리 보강'
    ]
  },
  {
    date: '2026-05-09',
    version: 'v1.4.3',
    changes: [
      '주제 생성 시 잘못된 API 키나 권한 부족 오류를 정확하게 안내하도록 에러 메시지 개선',
      '알 수 없는 API 에러 발생 시 상세 원인을 함께 표시하여 사용자 불편 해소',
      '오류 발생 시 앱 사용 편의성을 위해 에러 처리 로직(403, 404 예외 처리 등) 추가'
    ]
  },
  {
    date: '2026-05-08',
    version: 'v1.4.2',
    changes: [
      '표지 및 삽화 이미지 생성 시 텍스트 제거 지시를 통한 한글 깨짐 현상 완벽 방지',
      'API 한도 초과(429), 안전 정책 차단 등 시스템 에러 발생 시 직관적인 한국어 에러 메시지로 개선',
      '사용자 친화적 피드백 제공을 위한 에러 핸들링 유틸리티 도입'
    ]
  },
  {
    date: '2026-05-06',
    version: 'v1.4.1',
    changes: [
      '전역 시스템 알림 UI 구축 (기본 브라우저 팝업 알림 제거)',
      '전자책 완성 시 DOCX 파일 자동 다운로드 기능 추가',
      '불필요한 비용 발생 방지를 위해 "삽화 자동 생성" 기본값 비활성화',
      '결과물에 불필요한 강조 태그 노출 방지를 위한 프롬프트 최적화'
    ]
  },
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
                <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm ${note.date === 'Upcoming' ? 'bg-amber-500 scale-125' : (idx === 0 || (idx === 1 && patchNotes[0].date === 'Upcoming') ? 'bg-indigo-600 scale-125' : 'bg-slate-300')}`}></div>
                
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${note.date === 'Upcoming' ? 'bg-amber-100 text-amber-700' : (idx === 0 || (idx === 1 && patchNotes[0].date === 'Upcoming') ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600')}`}>
                    {note.date === 'Upcoming' ? 'Upcoming' : (idx === 0 || (idx === 1 && patchNotes[0].date === 'Upcoming') ? 'Latest' : note.version)}
                  </span>
                  <div className="flex items-center gap-1 text-slate-400 text-xs font-medium">
                    <Calendar size={12} />
                    {note.date}
                  </div>
                </div>

                <div className={`p-4 rounded-2xl border ${note.date === 'Upcoming' ? 'bg-amber-50/50 border-amber-200 shadow-sm' : (idx === 0 || (idx === 1 && patchNotes[0].date === 'Upcoming') ? 'bg-white border-indigo-200 shadow-md' : 'bg-slate-50 border-slate-200')}`}>
                  <ul className="space-y-2">
                    {note.changes.map((change, cIdx) => (
                      <li key={cIdx} className="flex items-start gap-2 text-sm text-slate-700 leading-relaxed">
                        <CheckCircle2 size={14} className={`mt-0.5 shrink-0 ${note.date === 'Upcoming' ? 'text-amber-500' : (idx === 0 || (idx === 1 && patchNotes[0].date === 'Upcoming') ? 'text-indigo-600' : 'text-slate-400')}`} />
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
