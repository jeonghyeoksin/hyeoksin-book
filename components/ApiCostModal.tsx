import React from 'react';
import { X, DollarSign, Info, Zap, BookOpen, Layers, Image as ImageIcon } from 'lucide-react';

interface ApiCostModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiCostModal: React.FC<ApiCostModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-6 bg-indigo-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">API 소모 비용 안내</h2>
              <p className="text-indigo-100 text-sm">Gemini 3.1 Pro 모델 기준 가이드</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto space-y-8">
          {/* Section 1: Basic Unit Price */}
          <section className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Info className="w-5 h-5 text-indigo-500" />
              1. 기본 단가 및 모델 정보
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Text Model</p>
                <p className="font-bold text-slate-800">Gemini 3.1 Pro Preview</p>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">입력 (Input)</span>
                    <span className="font-semibold text-slate-700">$1.25 / 1M tokens</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">출력 (Output)</span>
                    <span className="font-semibold text-slate-700">$5.00 / 1M tokens</span>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Image Model</p>
                <p className="font-bold text-slate-800">Gemini 3.1 Flash Image</p>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">이미지 생성</span>
                    <span className="font-semibold text-slate-700">건당 약 $0.03</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">해상도</span>
                    <span className="font-semibold text-slate-700">1K (1024x1024)</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Cost per Volume */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-500" />
                2. 전자책 사례별 비용 시뮬레이션 (원화)
              </h3>
            </div>
            
            <div className="overflow-hidden border border-slate-200 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-bottom border-slate-200">
                    <th className="px-4 py-3 text-sm font-bold text-slate-600">결과물 사례</th>
                    <th className="px-4 py-3 text-sm font-bold text-slate-600">분량(p)/챕터</th>
                    <th className="px-4 py-3 text-sm font-bold text-slate-600 text-right">최소 비용</th>
                    <th className="px-4 py-3 text-sm font-bold text-slate-600 text-right">최대 비용</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">미니 전자책 (간결)</td>
                    <td className="px-4 py-3 text-sm text-slate-600">약 10p / 4개</td>
                    <td className="px-4 py-3 text-sm font-bold text-indigo-400 text-right">240원</td>
                    <td className="px-4 py-3 text-sm font-bold text-indigo-600 text-right">450원</td>
                  </tr>
                  <tr className="bg-indigo-50/30">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">비즈니스 표준 (권장)</td>
                    <td className="px-4 py-3 text-sm text-slate-600">약 30p / 10개</td>
                    <td className="px-4 py-3 text-sm font-bold text-indigo-400 text-right">620원</td>
                    <td className="px-4 py-3 text-sm font-bold text-indigo-600 text-right">980원</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">전문 전략서 (심층)</td>
                    <td className="px-4 py-3 text-sm text-slate-600">약 60p / 15개</td>
                    <td className="px-4 py-3 text-sm font-bold text-indigo-400 text-right">1,150원</td>
                    <td className="px-4 py-3 text-sm font-bold text-indigo-600 text-right">1,680원</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">장편 프로젝트 (방대)</td>
                    <td className="px-4 py-3 text-sm text-slate-600">약 100p+ / 30개</td>
                    <td className="px-4 py-3 text-sm font-bold text-indigo-400 text-right">2,300원</td>
                    <td className="px-4 py-3 text-sm font-bold text-indigo-600 text-right">3,500원</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl">
              <p className="text-xs text-orange-800 leading-relaxed font-medium">
                * [중요] 모든 API 비용은 원화로 표시되었으나 환율 및 생성되는 실제 텍스트 분량, AI의 추론(Thinking) 깊이에 따라 현실적인 오차가 발생할 수 있습니다. 
                최소 비용은 삽화 미생성 기준이며, 최대 비용은 풍부한 삽화와 고밀도 추론 적용 시의 예상치입니다.
              </p>
            </div>
          </section>

          {/* Section 3: Key Factors */}
          <section className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-500" />
              3. 비용에 영향을 주는 핵심 요소
            </h3>
            <div className="space-y-3">
              <div className="flex gap-3 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                <div className="shrink-0 w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-sm">1</div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">추론 예산 (Thinking Budget)</p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    AI가 글을 쓰기 전 논리적인 구조를 짜는 과정입니다. 챕터당 최대 4,096 토큰을 사용하며, 글의 퀄리티를 비약적으로 높여줍니다.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                <div className="shrink-0 w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-sm">2</div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">챕터당 글자 수</p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    본 앱은 챕터당 약 4,000자 이상의 고밀도 원고를 생성합니다. 분량이 늘어날수록 출력 토큰 비용이 선형적으로 증가합니다.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                <div className="shrink-0 w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-sm">3</div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">이미지 삽입 여부</p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    표지 외에 본문 삽화(Illustration)를 추가할 때마다 건당 약 40원의 비용이 추가됩니다.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Conclusion */}
          <div className="p-6 bg-slate-900 rounded-2xl text-white">
            <div className="flex items-center gap-3 mb-3">
              <BookOpen className="w-6 h-6 text-indigo-400" />
              <h4 className="font-bold">가성비 분석 결론</h4>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              전통적인 대필 외주 비용(수십~백만 원) 대비 <span className="text-indigo-400 font-bold">약 0.1% 수준의 압도적인 가성비</span>를 자랑합니다. 
              50페이지 분량의 전문 서적을 단돈 <span className="text-indigo-400 font-bold">1,300원 미만</span>으로 집필할 수 있습니다.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-all active:scale-95"
          >
            확인 및 닫기
          </button>
        </div>
      </div>
    </div>
  );
};
