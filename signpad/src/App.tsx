import React, {type MouseEvent, type TouchEvent, useCallback, useEffect, useRef, useState} from 'react';
import {CheckCircle, Clipboard, Eye, X, Loader2, FileText} from 'lucide-react';

// --- TYPES & INTERFACES ---
interface Translations {
    title: string;
    copy_id_title: string;
    summary_title: string;
    total_qty_label: string;
    total_amount_label: string;
    due_date_label: string;
    signer_name_label: string;
    signer_name_placeholder: string;
    signature_title: string;
    signature_placeholder: string;
    clear_button: string;
    submit_button: string;
    disclaimer: string;
    error_fill_fields: string;
    error_signature_too_simple: string;
    error_signature_too_fast: string;
    error_checkboxes: string;
    label_terms: string;
    label_consent: string;
    message_sending: string;
    message_success: string;
    message_copy_id: string;
    message_fail: string;
    message_already_signed: string;
    lang_it: string;
    lang_en: string;
    lang_ar: string;
    message_loading: string;
    message_loading_details: string;
    error_loading_title: string;
    error_loading_details: string;
    carton: string;
    pair_qty_label?: string;
    box_qty_label?: string;
}

// Type for the translation map
type TranslationMap = {
    [key: string]: Translations;
};

// Type for the fetched invoice data (Presentation Layer Model)
interface InvoiceDetails {
    customer: string;
    invoice_id: string;
    pair_qty: number;
    box_qty: number;
    total_amount: string;
    due_date: string;
    currency_symbol: string;
    is_signed: boolean;
}

// Type for drawing events (handles both Mouse and Touch)
type DrawEvent = MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>;

// Definizione del punto tracciato con Timestamp
type TracePoint = { x: number, y: number, time: number };

// --- CONSTANTS ---
const MIN_TRACE_LENGTH = 1500; // Lunghezza minima del tracciato in pixel
const MIN_SIGNING_DURATION_MS = 500; // Durata minima del disegno (0.5 secondi)

// --- CURRENCY SYMBOL MAP ---
const CurrencySymbolMap: { [key: string]: string } = {
    'EUR': '€', 'USD': '$', 'GBP': '£', 'INR': '₹', 'JPY': '¥',
    'AUD': 'A$', 'CAD': 'C$', 'CNY': '¥', 'CHF': 'CHF', 'SEK': 'kr',
    'NOK': 'kr', 'DKK': 'kr', 'RUB': '₽', 'BRL': 'R$', 'ZAR': 'R',
    'SAR': '﷼', 'AED': 'د.إ',
};

// --- TRANSLATION DICTIONARY ---
const translations: TranslationMap = {
    en: {
        title: 'Goods Receipt Note',
        copy_id_title: 'Copy Invoice ID',
        summary_title: 'Summary Details',
        total_qty_label: 'Total Cartons:',
        total_amount_label: 'Total Amount:',
        due_date_label: 'Due Date:',
        signer_name_label: 'Signer Name',
        signer_name_placeholder: 'Enter your full name',
        signature_title: 'Electronic Signature',
        signature_placeholder: 'Use your mouse or finger to sign',
        clear_button: 'Clear Signature',
        submit_button: 'Submit and Confirm',
        disclaimer: 'By clicking "Submit and Confirm", you confirm receipt of',
        error_fill_fields: 'Please enter your name and sign the document.',
        error_signature_too_simple: 'The signature is too short. Please trace a complete signature.',
        error_signature_too_fast: 'The signature was traced too quickly.',
        error_checkboxes: 'Please agree to the terms and consent to sign.',
        label_terms: 'I agree to the Terms and Conditions',
        label_consent: 'I consent to use an electronic signature for this document',
        message_sending: 'Sending...',
        message_success: 'Signature acquired successfully!',
        message_copy_id: 'Invoice ID copied.',
        message_fail: 'Submission failed. Please try again later.',
        message_already_signed: 'This invoice has already been signed.',
        lang_it: 'Italiano',
        lang_en: 'English',
        lang_ar: 'العربية',
        message_loading: 'Loading Invoice Details...',
        message_loading_details: 'Please wait...',
        error_loading_title: 'Error Loading Invoice',
        error_loading_details: 'Invoice details could not be retrieved.',
        carton: 'Cartons',
        view_terms_btn: 'Review Terms & Conditions',
        scroll_hint: 'Please scroll to the bottom to accept.'
    },
    it: {
        title: 'Bolla di Consegna',
        copy_id_title: 'Copia ID Fattura',
        summary_title: 'Riepilogo Dettagli',
        total_qty_label: 'Colli Totali:',
        total_amount_label: 'Importo Totale:',
        due_date_label: 'Data Scadenza:',
        signer_name_label: 'Nome e Cognome del Firmatario',
        signer_name_placeholder: 'Inserisci il tuo nome completo',
        signature_title: 'Firma Elettronica',
        signature_placeholder: 'Usa il mouse o il dito per firmare',
        clear_button: 'Cancella Firma',
        submit_button: 'Invia e Conferma',
        disclaimer: 'Cliccando su "Invia e Conferma", confermi la ricezione di',
        error_fill_fields: 'Inserisci il tuo nome e firma il documento.',
        error_signature_too_simple: 'La firma è troppo breve.',
        error_signature_too_fast: 'La firma è stata tracciata troppo velocemente.',
        error_checkboxes: 'Accetta i termini e il consenso alla firma.',
        label_terms: 'Accetto i Termini e le Condizioni',
        label_consent: 'Acconsento all\'uso della firma elettronica',
        message_sending: 'Invio in corso...',
        message_success: 'Firma acquisita con successo!',
        message_copy_id: 'ID Fattura copiato.',
        message_fail: 'Invio fallito.',
        message_already_signed: 'Questa fattura è già stata firmata.',
        lang_it: 'Italiano',
        lang_en: 'English',
        lang_ar: 'العربية',
        message_loading: 'Caricamento...',
        message_loading_details: 'Attendere prego...',
        error_loading_title: 'Errore nel Caricamento',
        error_loading_details: 'I dettagli non sono stati recuperati.',
        carton: 'Colli',
        view_terms_btn: 'Visualizza Termini e Condizioni',
        scroll_hint: 'Scorri fino in fondo per accettare.'
    },
    ar: {
        title: 'وصل إستلام بضاعة',
        copy_id_title: 'نسخ رقم الفاتورة',
        summary_title: 'ملخص التفاصيل',
        pair_qty_label: 'الأزواج الأجمالية:',
        box_qty_label: 'الكراتين الإجمالية:',
        total_qty_label: 'الكراتين الإجمالية:',
        total_amount_label: 'المبلغ الإجمالي:',
        due_date_label: 'تاريخ الاستحقاق:',
        signer_name_label: 'اسم ولقب الموقع',
        signer_name_placeholder: 'أدخل اسمك الكامل',
        signature_title: 'التوقيع الإلكتروني',
        signature_placeholder: 'استخدم الفأرة أو إصبعك للتوقيع',
        clear_button: 'مسح التوقيع',
        submit_button: 'إرسال',
        disclaimer: 'بالضغط على "إرسال" ، فإنك تأكد استلام',
        error_fill_fields: 'الرجاء إدخل اسمك وتوقيع المستند.',
        error_signature_too_simple: 'التوقيع قصير جداً.',
        error_signature_too_fast: 'تم رسم التوقيع بسرعة كبيرة.',
        error_checkboxes: 'يرجى الموافقة على الشروط والموافقة على التوقيع.',
        label_terms: 'أوافق على الشروط والأحكام',
        label_consent: 'أوافق على تضمين هذا التوقيع الإلكتروني بالفاتورة',
        message_sending: 'جار الإرسال...',
        message_success: 'تم الحصول على التوقيع بنجاح! يمكنك إغلاق هذه النافذة.',
        message_copy_id: 'تم نسخ رقم الفاتورة.',
        message_fail: 'فشل الإرسال. حدث خطأ فادح. الرجاء المحاولة لاحقًا.',
        message_already_signed: 'تم توقيع وتأكيد هذه الفاتورة مسبقاً.',
        lang_it: 'Italiano',
        lang_en: 'English',
        lang_ar: 'العربية',
        message_loading: 'جاري تحميل تفاصيل الفاتورة...',
        message_loading_details: 'يرجى الانتظار بينما نقوم باسترداد بيانات الفاتورة بأمان.',
        error_loading_title: 'خطأ في تحميل الفاتورة',
        error_loading_details: 'تعذر استرداد تفاصيل الفاتورة. يرجى التأكد من صحة الرابط أو المحاولة مرة أخرى.',
        carton: 'كرتون',
        view_terms_btn: 'تأكيد الشروط والأحكام',
        scroll_hint: 'يرجى التمرير إلى الأسفل للموافقة.'
    },
};

const flagMap: { [key: string]: string } = { it: '🇮🇹', en: '🇬🇧', ar: '🇸🇦' };

// --- HELPER FUNCTIONS FOR COMPLEXITY VALIDATION ---
const calculateDistance = (p1: { x: number, y: number }, p2: { x: number, y: number }): number => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

// Validazione Complessità (Lunghezza)
const validateSignatureComplexity = (points: TracePoint[]): boolean => {
    if (points.length < 5) return false;

    let totalLength = 0;
    for (let i = 1; i < points.length; i++) {
        totalLength += calculateDistance(points[i - 1], points[i]);
    }

    return totalLength >= MIN_TRACE_LENGTH;
};

// Validazione Durata (Tempo)
const validateSignatureDuration = (points: TracePoint[]): boolean => {
    if (points.length < 2) return false;

    const startTime = points[0].time;
    const endTime = points[points.length - 1].time;
    const duration = endTime - startTime;

    return duration >= MIN_SIGNING_DURATION_MS;
};


// Main application component
const App: React.FC = () => {
    // State for localization and UI control
    const [lang, setLang] = useState<keyof TranslationMap>('ar');
    const T: Translations = translations[lang];

    const [signerName, setSignerName] = useState<string>('');
    const [isSigned, setIsSigned] = useState<boolean>(false);
    const [isDrawing, setIsDrawing] = useState<boolean>(false);
    const [message, setMessage] = useState<string>('');
    const [isDocumentSigned, setIsDocumentSigned] = useState<boolean>(false);

    // Checkbox States
    const [agreedToTerms, setAgreedToTerms] = useState<boolean>(false);
    const [consentToSign, setConsentToSign] = useState<boolean>(false);

    // Terms and Conditions
    const [isTermsOpen, setIsTermsOpen] = useState<boolean>(false);
    const [termsScrolled, setTermsScrolled] = useState<boolean>(false);

    // Fetching States
    const [invoiceId, setInvoiceId] = useState<string | null>(null);
    const [securityToken, setSecurityToken] = useState<string | null>(null);
    const [invoiceData, setInvoiceData] = useState<InvoiceDetails | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    // Preview States
    const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
    const [isPdfLoading, setIsPdfLoading] = useState<boolean>(true);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const contextRef = useRef<CanvasRenderingContext2D | null>(null);
    // REF per memorizzare tutti i punti tracciati (X, Y, Time)
    const tracePointsRef = useRef<TracePoint[]>([]);

    const textDirection: 'ltr' | 'rtl' = lang === 'ar' ? 'rtl' : 'ltr';

    // ----------------------------------------------------
    // INVOICE DATA FETCHING LOGIC (SECURE)
    // ----------------------------------------------------

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        const token = params.get('token');

        if (!id || !token) {
            setFetchError("Error: A secure Invoice ID and token must be provided in the URL.");
            setIsLoading(false);
            return;
        }

        setInvoiceId(id);
        setSecurityToken(token);

        const fetchInvoiceDetails = async (invoiceId: string, securityToken: string) => {
            setFetchError(null);
            setIsLoading(true);

            try {
                const response = await fetch('/api/method/frappe_signpad.api.get_invoice_data_securely', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        invoice_id: invoiceId,
                        token: securityToken,
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    const errorMessage = errorData.message || `HTTP Error: ${response.status} ${response.statusText}`;
                    throw new Error(errorMessage);
                }

                const doc_response = await response.json();
                const doc = doc_response.message;

                // --- DATA VALIDATION CHECK ---
                if (!doc || !doc.name || typeof doc.box_qty !== 'number' || typeof doc.pair_qty !== 'number' || typeof doc.grand_total !== 'number' || !doc.due_date || !doc.currency || typeof doc.is_signed === 'undefined') {
                    throw new Error(`Critical invoice data missing from server response.`);
                }

                const currencyCode = doc.currency.toUpperCase();
                const currencySymbol = CurrencySymbolMap[currencyCode] || currencyCode;
                const initialIsSigned: boolean = !!doc.is_signed;

                const loadedData: InvoiceDetails = {
                    customer: doc.customer,
                    invoice_id: doc.name,
                    pair_qty: doc.pair_qty,
                    box_qty: doc.box_qty,
                    currency_symbol: CurrencySymbolMap[doc.currency.toUpperCase()] || doc.currency,
                    total_amount: (doc.grand_total as number).toLocaleString('en-US', {minimumFractionDigits: 2}),
                    due_date: doc.due_date,
                    is_signed: initialIsSigned,
                    terms: doc.terms || "No terms provided.",
                };

                setInvoiceData(loadedData);
                setIsDocumentSigned(initialIsSigned);

                // FORCE CHECKBOXES IF SIGNED
                if (initialIsSigned) {
                    setMessage(T.message_already_signed);
                    setAgreedToTerms(true);
                    setConsentToSign(true);
                }

                setIsLoading(false);
            } catch (error: any) {
                console.error(`Failed to fetch invoice:`, error.message);
                setFetchError(`Access Denied or Failed to load invoice ${invoiceId}. Details: ${error.message.substring(0, 150)}...`);
                setIsLoading(false);
            }
        };

        fetchInvoiceDetails(id, token);
    }, [T]);
    // ----------------------------------------------------


    // Helper function to get normalized coordinates (offset)
    const getCoordinates = (event: DrawEvent): { offsetX: number, offsetY: number } => {
        const canvas = canvasRef.current;
        if (!canvas) return {offsetX: 0, offsetY: 0};

        const rect = canvas.getBoundingClientRect();
        let clientX: number, clientY: number;

        if ('touches' in event.nativeEvent && event.nativeEvent.touches.length > 0) {
            const touch = event.nativeEvent.touches[0];
            clientX = touch.clientX;
            clientY = touch.clientY;
        } else if ('changedTouches' in event.nativeEvent && event.nativeEvent.changedTouches.length > 0) {
            const touch = event.nativeEvent.changedTouches[0];
            clientX = touch.clientX;
            clientY = touch.clientY;
        } else if ('clientX' in event.nativeEvent) {
            clientX = event.nativeEvent.clientX;
            clientY = event.nativeEvent.clientY;
        } else {
            return {offsetX: 0, offsetY: 0};
        }

        const offsetX = clientX - rect.left;
        const offsetY = clientY - rect.top;

        return {offsetX, offsetY};
    };

    // Initializes the canvas context
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const {offsetWidth, offsetHeight} = canvas;
        canvas.width = offsetWidth * 2;
        canvas.height = offsetHeight * 2;

        const context = canvas.getContext('2d');
        if (context) {
            context.scale(2, 2);
            context.lineCap = 'round';
            context.lineJoin = 'round';
            context.strokeStyle = '#000000';
            context.lineWidth = 3;
            contextRef.current = context;
            context.clearRect(0, 0, offsetWidth, offsetHeight);
        }
    }, [invoiceData]);


    // Scroll Prevention useEffect (using direct DOM listener)
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // The handler uses 'isDrawing' state (which is only true if document is not already signed)
        const handleTouchMoveLock = (e: Event) => {
            if (isDrawing) {
                e.preventDefault();
            }
        };

        canvas.addEventListener('touchmove', handleTouchMoveLock as EventListener, {passive: false});

        return () => {
            canvas.removeEventListener('touchmove', handleTouchMoveLock as EventListener);
        };
    }, [isDrawing]);


    // Clear signature
    const clearSignature = (): void => {
        if (isDocumentSigned) return;

        const canvas = canvasRef.current;
        const context = contextRef.current;
        if (canvas && context) {
            context.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
            setIsSigned(false);
            setMessage('');
            tracePointsRef.current = [];
        }
    };

    // Callback to start drawing
    const startDrawing = useCallback((event: DrawEvent): void => {
        if (isDocumentSigned) return;

        const context = contextRef.current;
        if (!context) return;

        const {offsetX, offsetY} = getCoordinates(event);
        const currentTime = Date.now();

        // Aggiunge il punto iniziale al tracciato accumulato
        tracePointsRef.current.push({x: offsetX, y: offsetY, time: currentTime});

        context.beginPath();
        context.moveTo(offsetX, offsetY);
        setIsDrawing(true);
        setMessage('');
    }, [isDocumentSigned]);

    // Callback to draw
    const draw = useCallback((event: DrawEvent): void => {
        if (isDocumentSigned) return; // BLOCK: Stop drawing if document is already signed

        const context = contextRef.current;
        if (!isDrawing || !context) return;

        const {offsetX, offsetY} = getCoordinates(event);
        const currentTime = Date.now();

        // Registra il punto
        tracePointsRef.current.push({x: offsetX, y: offsetY, time: currentTime});

        context.lineTo(offsetX, offsetY);
        context.stroke();
    }, [isDrawing, isDocumentSigned]);

    // Callback to end drawing
    const endDrawing = useCallback((): void => {
        const context = contextRef.current;
        if (context) {
            context.closePath();
        }
        setIsDrawing(false);

        // Se ci sono punti totali, consideriamo la firma "presente" per sbloccare il bottone.
        if (tracePointsRef.current.length > 0) {
            setIsSigned(true);
        }

    }, []);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        // Checks if user is within 10px of the bottom
        const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 10;
        if (isAtBottom) setTermsScrolled(true);
    };


    // ----------------------------------------------------
    // FRAPPE SUBMISSION LOGIC (Final Validation Check)
    // ----------------------------------------------------

    const handleSubmit = async (): Promise<void> => {
        if (isDocumentSigned || !invoiceData || !securityToken) return;

        if (!signerName || !isSigned) { setMessage(T.error_fill_fields); return; }
        if (!agreedToTerms || !consentToSign) { setMessage(T.error_checkboxes); return; }
        if (!validateSignatureComplexity(tracePointsRef.current)) { setMessage(T.error_signature_too_simple); return; }
        if (!validateSignatureDuration(tracePointsRef.current)) { setMessage(T.error_signature_too_fast); return; }

        const canvas = canvasRef.current;
        if (!canvas) return;
        setMessage(T.message_sending);

        try {
            const response = await fetch('/api/method/frappe_signpad.api.submit_invoice_signature', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    invoice_id: invoiceData.invoice_id,
                    signer_name: signerName,
                    signature_image: canvas.toDataURL('image/png'),
                    signature_trace_data: tracePointsRef.current,
                    token: securityToken,
                }),
            });

            if (response.ok) {
                setMessage(T.message_success);
                setIsDocumentSigned(true);
                return;
            } else {
                const errorData: any = await response.json();
                const errorMessage = errorData.message || `Error: ${response.status} ${response.statusText}`;
                throw new Error(errorMessage);
            }
        } catch (error: any) {
            console.error(`Submission failed:`, error.message);
            setMessage(T.message_fail);
        }
    };

    // Function to copy the Invoice ID
    const copyInvoiceId = useCallback((): void => {
        if (!invoiceData) return;
        navigator.clipboard.writeText(invoiceData.invoice_id);
        setMessage(T.message_copy_id);
        setTimeout(() => setMessage(''), 2000);
    }, [invoiceData, T.message_copy_id]);

    // ----------------------------------------------------
    // LOADING & ERROR SCREENS
    // ----------------------------------------------------

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="text-xl font-semibold text-blue-600 flex flex-col items-center space-y-3">
                    <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none"
                         viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
                                strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className='text-2xl'>{T.message_loading}</span>
                    <p className='text-sm font-normal text-gray-500 text-center'>{T.message_loading_details}</p>
                </div>
            </div>
        );
    }

    if (fetchError || !invoiceData) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir={textDirection}>
                <div className="w-full max-w-xl bg-white p-8 rounded-xl shadow-xl border border-red-300">
                    <h1 className="text-2xl font-bold text-red-600 mb-4">{T.error_loading_title}</h1>
                    <p className="text-gray-700 mb-6">
                        {fetchError ? fetchError : T.error_loading_details}
                    </p>
                    <p className="text-sm text-gray-500">
                        {invoiceId ? `Invoice ID attempted: ${invoiceId}` : 'No Invoice ID provided in URL.'}
                    </p>
                </div>
            </div>
        );
    }



    const pdfUrl = `/api/method/frappe.utils.print_format.download_pdf?doctype=Sales%20Invoice&name=${encodeURIComponent(invoiceData.invoice_id)}&format=HTML%20Sales%20Invoice%20Format`;
    const isDisabled: boolean = isDocumentSigned;

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir={textDirection}>

            {/* --- PREVIEW OVERLAY --- */}
            {isPreviewOpen && (
                <div className="fixed inset-0 z-[100] bg-gray-900/95 backdrop-blur-sm flex flex-col p-2 md:p-8 overflow-hidden">
                    <div className="w-full max-w-5xl mx-auto h-full bg-white rounded-2xl shadow-2xl flex flex-col relative">
                        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                            <div className="flex items-center gap-2 text-gray-800">
                                <Eye size={22} className="text-blue-600" />
                                <span className="font-bold text-lg">{T.summary_title}</span>
                            </div>
                            <button onClick={() => { setIsPreviewOpen(false); setIsPdfLoading(true); }} className="p-2 hover:bg-red-100 text-gray-500 hover:text-red-600 rounded-full transition-colors">
                                <X size={28} />
                            </button>
                        </div>
                        <div className="flex-1 relative bg-gray-100 overflow-hidden">
                            {isPdfLoading && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10">
                                    <Loader2 className="animate-spin h-12 w-12 text-blue-600 mb-4" />
                                    <p className="text-gray-500 font-medium">{T.message_loading}</p>
                                </div>
                            )}
                            <iframe src={pdfUrl} title="Invoice Preview" className="w-full h-full border-none" onLoad={() => setIsPdfLoading(false)} />
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-center">
                            <button onClick={() => { setIsPreviewOpen(false); setIsPdfLoading(true); }} className="px-10 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all">
                                {lang === 'ar' ? 'إغلاق' : 'Close'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isTermsOpen && invoiceData && (
                <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <FileText className="text-blue-600" size={20} />
                                {T.view_terms_btn}
                            </h3>
                            <button onClick={() => setIsTermsOpen(false)} className="text-gray-400 hover:text-red-500">
                                <X size={24} />
                            </button>
                        </div>

                        <div
                            onScroll={handleScroll}
                            className="flex-1 overflow-y-auto p-6 prose prose-sm max-w-none text-gray-600 scroll-smooth"
                            dangerouslySetInnerHTML={{ __html: invoiceData.terms }}
                        />

                        <div className="p-6 border-t bg-gray-50 space-y-4 rounded-b-2xl">
                            {!termsScrolled && !isDisabled && (
                                <div className="text-amber-600 text-xs font-bold animate-pulse">
                                    {T.scroll_hint}
                                </div>
                            )}
                            <label className={`flex items-center gap-3 p-3 rounded-lg border ${!termsScrolled && !isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'cursor-pointer bg-white'}`}>
                                <input
                                    type="checkbox"
                                    checked={agreedToTerms}
                                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                                    disabled={!termsScrolled || isDisabled}
                                    className="w-6 h-6 rounded text-blue-600"
                                />
                                <span className="text-sm font-medium">{T.label_terms}</span>
                            </label>
                            <button
                                onClick={() => setIsTermsOpen(false)}
                                className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl"
                            >
                                {lang === 'ar' ? 'متابعة' : 'Continue'}
                            </button>
                        </div>
                    </div>
                </div>
            )}


            <div className="w-full max-w-2xl bg-white shadow-xl rounded-xl overflow-hidden border border-gray-200">

                {/* Header */}
                <header className={`p-6 text-white rounded-t-xl ${isDisabled ? 'bg-green-700' : 'bg-blue-600'}`}>
                    <div className="flex items-start justify-between">
                        <h1 className="text-3xl font-extrabold mb-1">{T.title}</h1>
                        <div className="flex items-center space-x-2 rtl:space-x-reverse">
                            <button onClick={() => setIsPreviewOpen(true)} className="bg-white/20 p-2 rounded-lg hover:bg-white/30 transition-colors">
                                <Eye size={20} />
                            </button>
                            <select value={lang} onChange={(e) => setLang(e.target.value as keyof TranslationMap)} className={`p-1 rounded-md ${isDisabled ? 'bg-green-800' : 'bg-blue-700'} text-white border-none`}>
                                <option value="it">{flagMap.it} {T.lang_it}</option>
                                <option value="en">{flagMap.en} {T.lang_en}</option>
                                <option value="ar">{flagMap.ar} {T.lang_ar}</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                        <p className="text-lg font-mono tracking-wider flex items-center gap-2">
                            {isDisabled && <CheckCircle size={20} className="text-green-300" />}
                            <span>{invoiceData.invoice_id}</span>
                        </p>
                        <button onClick={copyInvoiceId} className="text-white hover:text-blue-200 p-1">
                            <Clipboard size={18}/>
                        </button>
                    </div>
                </header>

                {/* Invoice Summary */}
                <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">{invoiceData.customer}</h2>
                    <div className="grid grid-cols-2 gap-4 text-gray-600">
                        <div>
                            <p className="font-medium">{T.box_qty_label}</p>
                            <p className="text-2xl font-bold text-blue-800">{invoiceData.box_qty}</p>
                        </div>
                        <div>
                            <p className="font-medium">{T.pair_qty_label}</p>
                            <p className="text-2xl font-bold text-blue-800">{invoiceData.pair_qty}</p>
                        </div>
                        <div className={textDirection === 'rtl' ? 'text-right' : ''}>
                            <p className="font-medium">{T.total_amount_label}</p>
                            <p className="text-2xl font-extrabold text-green-600">
                                {invoiceData.currency_symbol} {invoiceData.total_amount}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-lg font-medium text-gray-700 mb-2">{T.signer_name_label}</label>
                        <input
                            type="text"
                            value={signerName}
                            onChange={(e) => setSignerName(e.target.value)}
                            placeholder={T.signer_name_placeholder}
                            disabled={isDisabled}
                            className={`w-full px-4 py-3 border rounded-lg ${isDisabled ? 'bg-gray-100 text-gray-500' : 'border-gray-300 focus:ring-blue-500'}`}
                        />
                    </div>

                    <button
                        onClick={() => setIsTermsOpen(true)}
                        className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${agreedToTerms ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-100'}`}
                    >
                        <div className="flex items-center gap-3">
                            <FileText size={22} />
                            <span className="font-bold">{T.view_terms_btn}</span>
                        </div>
                        {agreedToTerms && <CheckCircle size={20} className="text-green-600" />}
                    </button>

                    {/* CHECKBOXES - LOGICALLY LOCKED IF SIGNED */}
                    <div className={`space-y-3 p-4 rounded-lg border transition-colors ${isDisabled ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'}`}>

                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={consentToSign}
                                onChange={(e) => setConsentToSign(e.target.checked)}
                                disabled={isDisabled}
                                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-100"
                            />
                            <span className={`text-sm ${isDisabled ? 'text-green-800 font-medium' : 'text-gray-700'}`}>
                                {T.label_consent} {isDisabled && " ✓"}
                            </span>
                        </label>
                    </div>

                    <div>
                        <h3 className="text-lg font-medium text-gray-700 mb-2">{T.signature_title}</h3>
                        <div className={`relative border-2 border-dashed rounded-lg overflow-hidden h-48 bg-gray-50 ${isDisabled ? 'border-green-500' : 'border-gray-400'}`}>
                            <canvas
                                ref={canvasRef}
                                className={`w-full h-full ${isDisabled ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
                                style={{touchAction: 'none'}}
                                onMouseDown={startDrawing} onMouseUp={endDrawing} onMouseMove={draw} onMouseLeave={endDrawing}
                                onTouchStart={startDrawing} onTouchEnd={endDrawing} onTouchMove={draw}
                            />
                            {!isSigned && <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-400">{T.signature_placeholder}</div>}
                            {isDisabled && (
                                <div className="absolute inset-0 flex items-center justify-center bg-green-50/80 text-green-800 text-lg font-bold pointer-events-none">
                                    <CheckCircle size={28} className="mx-2"/> {T.message_already_signed}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <p className="px-6 text-xs text-gray-500 text-center">
                    {T.disclaimer} <span className="font-black">{invoiceData.box_qty}</span> {T.carton}
                </p>

                <div className="p-6 pt-4 border-t border-gray-100">
                    {message && (
                        <div className={`p-3 mb-4 rounded-lg text-sm font-semibold flex items-center ${message.includes(T.message_success.substring(0, 5)) || isDisabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {message}
                        </div>
                    )}
                    <div className="flex gap-4">
                        <button onClick={clearSignature} disabled={isDisabled} className="flex-1 px-6 py-3 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 disabled:bg-gray-400">
                            {T.clear_button}
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isDisabled || !signerName || !isSigned || !agreedToTerms || !consentToSign}
                            className="flex-1 px-6 py-3 bg-green-500 text-white font-semibold rounded-xl hover:bg-green-600 disabled:bg-gray-400"
                        >
                            {T.submit_button}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default App;
