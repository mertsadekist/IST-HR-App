import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as offboardingApi from '@api/offboardingApi';
import * as assetsApi from '@api/assetsApi';
import { Printer, ArrowLeft, Loader2, Check } from 'lucide-react';
import dayjs from 'dayjs';

export default function HandoverSheet() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [assets, setAssets] = useState([]);
  const [ktItems, setKtItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch offboarding details (includes steps and checklist items)
      const { data: obData } = await offboardingApi.getOffboarding(id);
      setRecord(obData);

      // 2. Extract Knowledge Transfer checklist items (Step 2)
      const ktStep = obData.steps?.find(s => s.step_number === 2 || s.name.toLowerCase().includes('knowledge'));
      if (ktStep && ktStep.checklist_items) {
        setKtItems(ktStep.checklist_items);
      }

      // 3. Fetch active assets assigned to the employee
      if (obData.employee_id) {
        const { data: assetData } = await assetsApi.getAssets({
          employee_id: obData.employee_id,
          status: 'Active'
        });
        setAssets(assetData);
      }
    } catch (err) {
      console.error('Failed to load handover sheet data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-surface-50">
        <Loader2 className="w-8 h-8 text-brand-700 animate-spin" />
        <p className="mt-2 text-surface-600 font-medium">Loading Handover Sheet / جاري تحميل ورقة التسليم...</p>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-surface-50 text-center px-4">
        <p className="text-red-600 font-bold text-lg">Error: Offboarding record not found.</p>
        <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-brand-700 text-white rounded-lg hover:bg-brand-800 transition">
          Go Back / العودة
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-100 p-4 md:p-8 flex justify-center items-start print:p-0 print:bg-white">
      {/* Floating Actions Panel - Hidden when printing */}
      <div className="fixed bottom-6 right-6 flex flex-col md:flex-row gap-3 z-50 print:hidden">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2.5 bg-surface-800 hover:bg-surface-900 text-white font-medium rounded-xl shadow-lg transition-all"
        >
          <ArrowLeft size={16} />
          <span>Back to Offboarding / العودة</span>
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-700 hover:bg-brand-800 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
        >
          <Printer size={18} />
          <span>Print Sheet / طباعة المستند</span>
        </button>
      </div>

      {/* Main A4 Document Sheet */}
      <div className="w-full max-w-[210mm] min-h-[297mm] bg-white shadow-2xl p-[15mm] md:p-[20mm] border border-surface-200 rounded-2xl print:border-none print:shadow-none print:p-[5mm] print:rounded-none flex flex-col justify-between">
        
        {/* Document Content Wrapper */}
        <div>
          {/* Bilingual Corporate Header */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-start border-b-2 border-brand-700 pb-4 mb-6">
            <div className="text-left">
              <h1 className="text-xl font-bold text-brand-900 leading-tight">IST HR MANAGEMENT SYSTEM</h1>
              <p className="text-xs text-surface-500 font-medium mt-1">OFFBOARDING HANDOVER & RECEIPT SHEET</p>
            </div>
            
            <div className="text-right mt-3 md:mt-0 font-arabic" dir="rtl">
              <h1 className="text-xl font-bold text-brand-900 leading-tight">نظام إدارة الموارد البشرية IST</h1>
              <p className="text-xs text-surface-500 font-medium mt-1">نموذج استلام وتسليم المهام والأصول لإنهاء الخدمة</p>
            </div>
          </div>

          {/* Employee & Record Information Section */}
          <div className="bg-surface-50 p-4 rounded-xl mb-6 border border-surface-200 print:bg-transparent print:border-surface-300">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div className="flex justify-between border-b border-surface-200 pb-1.5">
                <span className="text-surface-500 font-medium">Employee Name:</span>
                <span className="font-semibold text-surface-900">{record.first_name} {record.last_name}</span>
              </div>
              <div className="flex justify-between border-b border-surface-200 pb-1.5 font-arabic text-right" dir="rtl">
                <span className="text-surface-500">اسم الموظف:</span>
                <span className="font-semibold text-surface-900">{record.first_name} {record.last_name}</span>
              </div>

              <div className="flex justify-between border-b border-surface-200 pb-1.5">
                <span className="text-surface-500 font-medium">Department / Role:</span>
                <span className="font-semibold text-surface-900">{record.department_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between border-b border-surface-200 pb-1.5 font-arabic text-right" dir="rtl">
                <span className="text-surface-500">القسم / الدور:</span>
                <span className="font-semibold text-surface-900">{record.department_name || 'غير محدد'}</span>
              </div>

              <div className="flex justify-between border-b border-surface-200 pb-1.5">
                <span className="text-surface-500 font-medium">Start Date:</span>
                <span className="font-semibold text-surface-900">{dayjs(record.employment_start).format('YYYY-MM-DD')}</span>
              </div>
              <div className="flex justify-between border-b border-surface-200 pb-1.5 font-arabic text-right" dir="rtl">
                <span className="text-surface-500">تاريخ بدء العمل:</span>
                <span className="font-semibold text-surface-900">{dayjs(record.employment_start).format('YYYY-MM-DD')}</span>
              </div>

              <div className="flex justify-between border-b border-surface-200 pb-1.5">
                <span className="text-surface-500 font-medium">Last Working Day (LWD):</span>
                <span className="font-semibold text-brand-700">{dayjs(record.last_working_day).format('YYYY-MM-DD')}</span>
              </div>
              <div className="flex justify-between border-b border-surface-200 pb-1.5 font-arabic text-right" dir="rtl">
                <span className="text-surface-500">آخر يوم عمل:</span>
                <span className="font-semibold text-brand-700">{dayjs(record.last_working_day).format('YYYY-MM-DD')}</span>
              </div>
            </div>
          </div>

          {/* Section 1: Knowledge Transfer & Handover Tasks */}
          <div className="mb-6">
            <div className="flex justify-between items-center bg-brand-900 text-white px-3 py-1.5 rounded-lg mb-3">
              <span className="font-semibold text-sm">1. Knowledge Transfer & Handover Items</span>
              <span className="font-arabic text-sm font-semibold" dir="rtl">١. مهام تسليم العمل ونقل المعرفة</span>
            </div>

            <table className="w-full text-xs text-left border-collapse border border-surface-300">
              <thead>
                <tr className="bg-surface-100 print:bg-transparent">
                  <th className="border border-surface-300 p-2 text-surface-700 w-12 text-center">#</th>
                  <th className="border border-surface-300 p-2 text-surface-700">Handover Task Description / وصف مهمة التسليم</th>
                  <th className="border border-surface-300 p-2 text-surface-700 w-24 text-center">System Status / الحالة</th>
                  <th className="border border-surface-300 p-2 text-surface-700 w-36 text-center">Physical Receipt / تأكيد استلام</th>
                </tr>
              </thead>
              <tbody>
                {ktItems.length > 0 ? (
                  ktItems.map((item, index) => (
                    <tr key={item.id} className="hover:bg-surface-50">
                      <td className="border border-surface-300 p-2 text-center font-semibold">{index + 1}</td>
                      <td className="border border-surface-300 p-2 text-surface-900">{item.label}</td>
                      <td className="border border-surface-300 p-2 text-center">
                        {item.is_checked ? (
                          <span className="inline-flex items-center text-green-700 font-semibold gap-0.5">
                            <Check size={12} />
                            Done
                          </span>
                        ) : (
                          <span className="text-surface-400">Pending</span>
                        )}
                      </td>
                      <td className="border border-surface-300 p-2 text-center">
                        <div className="w-5 h-5 border-2 border-surface-400 mx-auto rounded"></div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="border border-surface-300 p-4 text-center text-surface-400 italic">
                      No specific knowledge transfer items logged in the system. / لا توجد مهام تسليم محددة في النظام.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Section 2: Assigned Assets and Equipment Return */}
          <div className="mb-6">
            <div className="flex justify-between items-center bg-brand-900 text-white px-3 py-1.5 rounded-lg mb-3">
              <span className="font-semibold text-sm">2. Company Asset Return & Equipment Collection</span>
              <span className="font-arabic text-sm font-semibold" dir="rtl">٢. إرجاع عهد وأصول الشركة للموظف</span>
            </div>

            <table className="w-full text-xs text-left border-collapse border border-surface-300">
              <thead>
                <tr className="bg-surface-100 print:bg-transparent">
                  <th className="border border-surface-300 p-2 text-surface-700 w-12 text-center">#</th>
                  <th className="border border-surface-300 p-2 text-surface-700">Asset Name / اسم الأصل</th>
                  <th className="border border-surface-300 p-2 text-surface-700">Type / النوع</th>
                  <th className="border border-surface-300 p-2 text-surface-700">Identifier / المعرف</th>
                  <th className="border border-surface-300 p-2 text-surface-700 w-36 text-center">Returned Condition / حالة التسليم</th>
                  <th className="border border-surface-300 p-2 text-surface-700 w-24 text-center">Verified / تم الاستلام</th>
                </tr>
              </thead>
              <tbody>
                {assets.length > 0 ? (
                  assets.map((asset, index) => (
                    <tr key={asset.id} className="hover:bg-surface-50">
                      <td className="border border-surface-300 p-2 text-center font-semibold">{index + 1}</td>
                      <td className="border border-surface-300 p-2 text-surface-900 font-semibold">{asset.name}</td>
                      <td className="border border-surface-300 p-2 text-surface-600">{asset.asset_type}</td>
                      <td className="border border-surface-300 p-2 text-surface-500 font-mono">{asset.identifier || 'N/A'}</td>
                      <td className="border border-surface-300 p-2 text-center text-surface-400 italic">
                        .........................
                      </td>
                      <td className="border border-surface-300 p-2 text-center">
                        <div className="w-5 h-5 border-2 border-surface-400 mx-auto rounded"></div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="border border-surface-300 p-4 text-center text-surface-400 italic">
                      No active assets are assigned to this employee in the registry. / لا توجد عهد أو أصول مسندة للموظف في السجل.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Bilingual Formal Undertaking Declaration */}
          <div className="border border-brand-700/30 p-4 rounded-xl mb-8 bg-brand-50/10 text-[11px] leading-relaxed text-surface-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="text-left font-serif">
                <p className="font-bold text-surface-900 mb-1">Employee Declaration:</p>
                <p>
                  I hereby declare and confirm that I have returned all company assets, hardware, credit cards, access codes, and documents in my possession.
                  I have completed all knowledge transfer tasks assigned by my manager. I understand that my final clearance is contingent upon successful physical verification of the above assets.
                </p>
              </div>
              <div className="text-right font-arabic" dir="rtl">
                <p className="font-bold text-surface-900 mb-1">إقرار وإعلان الموظف:</p>
                <p>
                  أقر وأؤكد بموجب هذا أنني قمت بإرجاع جميع أصول الشركة، والأجهزة، وبطاقات الائتمان، ورموز الدخول، والمستندات التي كانت في حوزتي.
                  كما أؤكد إكمال جميع مهام نقل المعرفة والمهام المسندة إليّ من قبل مديري المباشر. وأدرك أن التسوية المالية وبراءة الذمة النهائية مشروطة بالتحقق الفعلي والكامل من جميع البنود أعلاه.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Professional Triple Signature Box */}
        <div>
          <div className="grid grid-cols-3 gap-6 pt-4 border-t border-surface-300">
            <div className="text-center">
              <p className="text-xs font-semibold text-surface-800">Employee Signature</p>
              <p className="text-[10px] font-arabic text-surface-500 mb-8" dir="rtl">توقيع الموظف المستقيل / المنهى خدمته</p>
              <div className="h-10 border-b border-surface-400 border-dashed mx-6"></div>
              <p className="text-[10px] text-surface-500 mt-2">Date / التاريخ: .........................</p>
            </div>

            <div className="text-center">
              <p className="text-xs font-semibold text-surface-800">Line Manager Signature</p>
              <p className="text-[10px] font-arabic text-surface-500 mb-8" dir="rtl">توقيع ومصادقة المدير المباشر</p>
              <div className="h-10 border-b border-surface-400 border-dashed mx-6"></div>
              <p className="text-[10px] text-surface-500 mt-2">Date / التاريخ: .........................</p>
            </div>

            <div className="text-center">
              <p className="text-xs font-semibold text-surface-800">HR Representative Signature</p>
              <p className="text-[10px] font-arabic text-surface-500 mb-8" dir="rtl">توقيع واعتماد الموارد البشرية</p>
              <div className="h-10 border-b border-surface-400 border-dashed mx-6"></div>
              <p className="text-[10px] text-surface-500 mt-2">Date / التاريخ: .........................</p>
            </div>
          </div>

          {/* Clean Printed Footer */}
          <div className="text-center text-[9px] text-surface-400 mt-8 border-t border-surface-100 pt-2 flex justify-between">
            <span>Generated via IST HR Portal — Case Ref: OFF-{id}</span>
            <span>Printed on: {dayjs().format('YYYY-MM-DD HH:mm')}</span>
          </div>
        </div>

      </div>

      {/* Global CSS Inject to customize printing behavior */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:border-none {
            border: none !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:p-0 {
            padding: 0 !important;
          }
          .print\\:bg-transparent {
            background-color: transparent !important;
          }
          .print\\:border-surface-300 {
            border-color: #cbd5e1 !important;
          }
        }
      `}} />
    </div>
  );
}
