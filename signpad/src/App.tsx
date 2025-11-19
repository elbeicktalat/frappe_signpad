import React, {type MouseEvent, type TouchEvent, useCallback, useEffect, useRef, useState} from 'react';
import {CheckCircle, Clipboard} from 'lucide-react'; // Import CheckCircle icon

// Defines the structure of the translations
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
    message_sending: string;
    message_success: string;
    message_copy_id: string;
    message_fail: string;
    // New message for already signed document
    message_already_signed: string;
    lang_it: string;
    lang_en: string;
    lang_ar: string;
    message_loading: string;
    message_loading_details: string;
    error_loading_title: string;
    error_loading_details: string;
}

// Type for the translation map
type TranslationMap = {
    [key: string]: Translations;
};

// Type for the fetched invoice data (Presentation Layer Model)
interface InvoiceDetails {
    invoice_id: string;
    total_qty: number;
    total_amount: string; // Formatted number string (e.g., "8,500.00")
    due_date: string;
    currency_symbol: string; // The dynamically fetched currency symbol (e.g., '€', '$')
    is_signed: boolean;
}

// Type for drawing events (handles both Mouse and Touch)
type DrawEvent = MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>;

// --- CURRENCY SYMBOL MAP ---
const CurrencySymbolMap: { [key: string]: string } = {
    'EUR': '€',
    'USD': '$',
    'GBP': '£',
    'INR': '₹',
    'JPY': '¥',
    'AUD': 'A$',
    'CAD': 'C$',
    'CNY': '¥',
    'CHF': 'CHF',
    'SEK': 'kr',
    'NOK': 'kr',
    'DKK': 'kr',
    'RUB': '₽',
    'BRL': 'R$',
    'ZAR': 'R',
    'SAR': '﷼',
    'AED': 'د.إ',
};

// --- TRANSLATION DICTIONARY ---
const translations: TranslationMap = {
    en: {
        title: 'Invoice Confirmation & Signature',
        copy_id_title: 'Copy Invoice ID',
        summary_title: 'Summary Details',
        total_qty_label: 'Total Quantity:',
        total_amount_label: 'Total Amount:',
        due_date_label: 'Due Date:',
        signer_name_label: 'Signer Name',
        signer_name_placeholder: 'Enter your full name',
        signature_title: 'Electronic Signature',
        signature_placeholder: 'Use your mouse or finger to sign',
        clear_button: 'Clear Signature',
        submit_button: 'Submit and Confirm',
        disclaimer: 'By clicking "Submit and Confirm" you declare that you have received, understood, and accepted the above invoice.',
        error_fill_fields: 'Please enter your name and sign the document.',
        message_sending: 'Sending...',
        message_success: 'Signature acquired successfully! The invoice will be sent to you shortly. You can close this Window.',
        message_copy_id: 'Invoice ID copied.',
        message_fail: 'Submission failed. A critical error occurred. Please try again later.',
        message_already_signed: 'This invoice has already been signed and confirmed.', // ADDED
        lang_it: 'Italiano',
        lang_en: 'English',
        lang_ar: 'العربية',
        message_loading: 'Loading Invoice Details...',
        message_loading_details: 'Please wait while we securely retrieve the invoice data.',
        error_loading_title: 'Error Loading Invoice',
        error_loading_details: 'Invoice details could not be retrieved. Please ensure the link is correct or try again.',
    },
    it: {
        title: 'Conferma & Firma Fattura',
        copy_id_title: 'Copia ID Fattura',
        summary_title: 'Riepilogo Dettagli',
        total_qty_label: 'Quantità Totale:',
        total_amount_label: 'Importo Totale:',
        due_date_label: 'Data Scadenza:',
        signer_name_label: 'Nome e Cognome del Firmatario',
        signer_name_placeholder: 'Inserisci il tuo nome completo',
        signature_title: 'Firma Elettronica',
        signature_placeholder: 'Usa il mouse o il dito per firmare',
        clear_button: 'Cancella Firma',
        submit_button: 'Invia e Conferma',
        disclaimer: 'Cliccando su "Invia e Conferma" si dichiara di aver ricevuto, compreso e accettato la fattura sopra riportata.',
        error_fill_fields: 'Per favore, inserisci il tuo nome e firma il documento.',
        message_sending: 'Invio in corso...',
        message_success: 'Firma acquisita con successo! La fattura ti sarà inviata a breve. Ora puoi chiudere questa finestra.',
        message_copy_id: 'ID Fattura copiato.',
        message_fail: 'Invio fallito. Si è verificato un errore critico. Riprova più tardi.',
        message_already_signed: 'Questa fattura è già stata firmata e confermata.', // ADDED
        lang_it: 'Italiano',
        lang_en: 'English',
        lang_ar: 'العربية',
        message_loading: 'Caricamento Dettagli Fattura...',
        message_loading_details: 'Attendere prego mentre recuperiamo in sicurezza i dati della fattura.',
        error_loading_title: 'Errore nel Caricamento della Fattura',
        error_loading_details: 'I dettagli della fattura non sono stati recuperati. Assicurati che il link sia corretto o riprova.',
    },
    ar: {
        title: 'تأكيد وتوقيع الفاتورة',
        copy_id_title: 'نسخ رقم الفاتورة',
        summary_title: 'ملخص التفاصيل',
        total_qty_label: 'الكمية الإجمالية:',
        total_amount_label: 'المبلغ الإجمالي:',
        due_date_label: 'تاريخ الاستحقاق:',
        signer_name_label: 'اسم ولقب الموقع',
        signer_name_placeholder: 'أدخل اسمك الكامل',
        signature_title: 'التوقيع الإلكتروني',
        signature_placeholder: 'استخدم الفأرة أو إصبعك للتوقيع',
        clear_button: 'مسح التوقيع',
        submit_button: 'إرسال وتأكيد',
        disclaimer: 'بالنقر على "إرسال وتأكيد" ، فإنك تقر بأنك قد استلمت وفهمت وقبلت الفاتورة المذكورة أعلاه.',
        error_fill_fields: 'الرجاء إدخال اسمك وتوقيع المستند.',
        message_sending: 'جار الإرسال...',
        message_success: 'تم الحصول على التوقيع بنجاح! سيتم إرسال الفاتورة إليك قريبًا. يمكنك إغلاق هذه النافذة.',
        message_copy_id: 'تم نسخ رقم الفاتورة.',
        message_fail: 'فشل الإرسال. حدث خطأ فادح. الرجاء المحاولة لاحقًا.',
        message_already_signed: 'تم توقيع وتأكيد هذه الفاتورة مسبقاً.', // ADDED
        lang_it: 'Italiano',
        lang_en: 'English',
        lang_ar: 'العربية',
        message_loading: 'جاري تحميل تفاصيل الفاتورة...',
        message_loading_details: 'يرجى الانتظار بينما نقوم باسترداد بيانات الفاتورة بأمان.',
        error_loading_title: 'خطأ في تحميل الفاتورة',
        error_loading_details: 'تعذر استرداد تفاصيل الفاتورة. يرجى التأكد من صحة الرابط أو المحاولة مرة أخرى.',
    },
};

// --- FLAG MAP (UNICODE EMOJI) ---
const flagMap: { [key: string]: string } = {
    it: '🇮🇹',
    en: '🇬🇧',
    ar: '🇸🇦',
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
    const [isDocumentSigned, setIsDocumentSigned] = useState<boolean>(false); // Initial state from server

    // State for Data Fetching
    const [invoiceId, setInvoiceId] = useState<string | null>(null);
    const [securityToken, setSecurityToken] = useState<string | null>(null); // SECURE: Store the token
    const [invoiceData, setInvoiceData] = useState<InvoiceDetails | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    // Typing the refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const contextRef = useRef<CanvasRenderingContext2D | null>(null);

    const textDirection: 'ltr' | 'rtl' = lang === 'ar' ? 'rtl' : 'ltr';

    // ----------------------------------------------------
    // INVOICE DATA FETCHING LOGIC (SECURE)
    // ----------------------------------------------------

    useEffect(() => {
        // ... (URL parsing logic remains the same)
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

        const frappeFetchUrl = '/api/method/frappe_signpad.api.get_invoice_data_securely';

        const fetchInvoiceDetails = async (invoiceId: string, securityToken: string) => {
            setFetchError(null);
            setIsLoading(true);

            try {
                const response = await fetch(frappeFetchUrl, {
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

                // --- 🛑 DATA VALIDATION CHECK ---
                if (!doc || !doc.name || typeof doc.total_qty !== 'number' || typeof doc.grand_total !== 'number' || !doc.due_date || !doc.currency || typeof doc.is_signed === 'undefined') {
                    const missingFields = [
                        !doc.name && 'Invoice ID (name)', typeof doc.total_qty !== 'number' && 'Total Quantity',
                        typeof doc.grand_total !== 'number' && 'Total Amount', !doc.due_date && 'Due Date',
                        !doc.currency && 'Currency', typeof doc.is_signed === 'undefined' && 'Is Signed Status'
                    ].filter(Boolean).join(', ');
                    throw new Error(`Critical invoice data missing from server response: ${missingFields}.`);
                }

                const currencyCode = doc.currency.toUpperCase();
                const currencySymbol = CurrencySymbolMap[currencyCode] || currencyCode;

                const initialIsSigned: boolean = !!doc.is_signed;

                const loadedData: InvoiceDetails = {
                    invoice_id: doc.name,
                    total_qty: doc.total_qty,
                    currency_symbol: currencySymbol,
                    total_amount: `${(doc.grand_total as number).toLocaleString('en-US', {minimumFractionDigits: 2})}`,
                    due_date: doc.due_date,
                    is_signed: initialIsSigned, // Map to interface
                };

                setInvoiceData(loadedData);
                setIsDocumentSigned(initialIsSigned); // SET: Store the initial signed status

                // 4. MESSAGE: Display warning if already signed
                if (initialIsSigned) {
                    setMessage(T.message_already_signed);
                }

                setIsLoading(false);
                return;

            } catch (error: any) {
                // Log the failure without retrying
                console.error(`Failed to fetch invoice:`, error.message);
                setFetchError(`Access Denied or Failed to load invoice ${invoiceId}. Details: ${error.message.substring(0, 150)}...`);
                setIsLoading(false);
                return;
            }
        };

        fetchInvoiceDetails(id, token);
    }, []);

    // ----------------------------------------------------
    // CANVAS LOGIC FOR SIGNATURE (Prevent Drawing if signed)
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

    // Clear signature can only happen if the document hasn't been submitted yet
    const clearSignature = (): void => {
        if (isDocumentSigned) return; // Block clearing if already signed in the system

        const canvas = canvasRef.current;
        const context = contextRef.current;
        if (canvas && context) {
            context.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
            setIsSigned(false);
            setMessage('');
        }
    };

    // Callback to start drawing
    const startDrawing = useCallback((event: DrawEvent): void => {
        if (isDocumentSigned) return; // BLOCK: Stop drawing if document is already signed

        const context = contextRef.current;
        if (!context) return;

        const {offsetX, offsetY} = getCoordinates(event);

        context.beginPath();
        context.moveTo(offsetX, offsetY);
        setIsDrawing(true);
        setIsSigned(true);
    }, [isDocumentSigned]); // Added isDocumentSigned dependency

    // Callback to draw
    const draw = useCallback((event: DrawEvent): void => {
        if (isDocumentSigned) return; // BLOCK: Stop drawing if document is already signed

        const context = contextRef.current;
        if (!isDrawing || !context) return;

        const {offsetX, offsetY} = getCoordinates(event);

        context.lineTo(offsetX, offsetY);
        context.stroke();
    }, [isDrawing, isDocumentSigned]); // Added isDocumentSigned dependency

    // Callback to end drawing
    const endDrawing = useCallback((): void => {
        const context = contextRef.current;
        if (context) {
            context.closePath();
        }
        setIsDrawing(false);
    }, []);

    // ----------------------------------------------------
    // FRAPPE SUBMISSION LOGIC (Block if signed)
    // ----------------------------------------------------

    const handleSubmit = async (): Promise<void> => {
        setMessage('');

        if (isDocumentSigned) { // Final check before submission
            setMessage(T.message_already_signed);
            return;
        }

        if (!invoiceData || !securityToken) {
            setMessage(T.message_fail + " (Invoice data or security token missing)");
            return;
        }

        if (!signerName || !isSigned) {
            setMessage(T.error_fill_fields);
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        const signatureBase64: string = canvas.toDataURL('image/png');

        const dataToSend = {
            invoice_id: invoiceData.invoice_id,
            signer_name: signerName,
            signature_image: signatureBase64,
            token: securityToken,
        };

        const frappeApiUrl: string = '/api/method/frappe_signpad.api.submit_invoice_signature';

        setMessage(T.message_sending);

        try {
            const response = await fetch(frappeApiUrl, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(dataToSend),
            });

            if (response.ok) {
                setMessage(T.message_success);
                setIsDocumentSigned(true); // UPDATE: Mark as signed locally after successful submission
                return;
            } else {
                const errorData: any = await response.json();
                const errorMessage = errorData.message || `Frappe Error: ${response.status} ${response.statusText}`;
                throw new Error(errorMessage);
            }
        } catch (error: any) {
            // Log the failure and display the fail message
            console.error(`Submission failed:`, error.message);
            setMessage(T.message_fail);
        }
    };

    // Function to copy the Invoice ID
    const copyInvoiceId = useCallback((): void => {
        if (!invoiceData) return;

        try {
            const el = document.createElement('textarea');
            el.value = invoiceData.invoice_id;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            setMessage(T.message_copy_id);
        } catch (e) {
            console.error("Copy failed", e);
            if (document.execCommand('copy')) {
                setMessage(T.message_copy_id);
            }
        }
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

    const data = invoiceData as InvoiceDetails;
    const isDisabled: boolean = isDocumentSigned; // Use a single flag to disable UI

    // ----------------------------------------------------
    // MAIN UI
    // ----------------------------------------------------
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir={textDirection}>
            <div className="w-full max-w-2xl bg-white shadow-xl rounded-xl overflow-hidden border border-gray-200">

                {/* Header */}
                <header className={`p-6 text-white rounded-t-xl ${isDisabled ? 'bg-green-700' : 'bg-blue-600'}`}>
                    <div className="flex items-start justify-between">
                        <h1 className="text-3xl font-extrabold mb-1">{T.title}</h1>

                        {/* Language Selector with Flags */}
                        <div className="flex items-center space-x-2">
                            <select
                                value={lang}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLang(e.target.value as keyof TranslationMap)}
                                className={`p-1 rounded-md cursor-pointer focus:ring-blue-300 focus:border-blue-300 ${isDisabled ? 'bg-green-800 text-white' : 'bg-blue-700 text-white'}`}
                            >
                                <option value="it">{flagMap.it} {T.lang_it}</option>
                                <option value="en">{flagMap.en} {T.lang_en}</option>
                                <option value="ar">{flagMap.ar} {T.lang_ar}</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                        <p className="text-lg font-mono tracking-wider flex items-center space-x-2 rtl:space-x-reverse">
                            {/* 1. ADDED: Green checkmark next to ID if signed */}
                            {isDisabled && <CheckCircle size={20} className="text-green-300; ml-2 mr-2"/>}
                            <span>{data.invoice_id}</span>
                        </p>
                        <button
                            onClick={copyInvoiceId}
                            className="text-white hover:text-blue-200 transition duration-150 p-1 rounded-full"
                            title={T.copy_id_title}
                        >
                            <Clipboard size={16}/>
                        </button>
                    </div>
                </header>

                {/* Invoice Summary */}
                <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">{T.summary_title}</h2>
                    <div
                        className={`grid grid-cols-2 gap-4 text-gray-600 ${textDirection === 'rtl' ? 'text-right' : ''}`}>
                        <div>
                            <p className="font-medium">{T.total_qty_label}</p>
                            <p className="text-2xl font-bold text-blue-800">{data.total_qty}</p>
                        </div>
                        <div className='text-right'>
                            <p className="font-medium">{T.total_amount_label}</p>
                            <p className="text-3xl font-extrabold text-green-600">
                                {data.currency_symbol} {data.total_amount}
                            </p>
                        </div>
                        <div className="col-span-2">
                            <p className="font-medium">{T.due_date_label}</p>
                            <p className="text-lg font-semibold">{data.due_date}</p>
                        </div>
                    </div>
                </div>

                {/* Name Input */}
                <div className="p-6 pt-0">
                    <label htmlFor="signerName" className="block text-lg font-medium text-gray-700 mb-2">
                        {T.signer_name_label}
                    </label>
                    <input
                        id="signerName"
                        type="text"
                        value={signerName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSignerName(e.target.value)}
                        placeholder={T.signer_name_placeholder}
                        disabled={isDisabled}
                        className={`w-full px-4 py-3 border rounded-lg shadow-sm transition ${isDisabled ? 'bg-gray-100 text-gray-500 border-gray-200' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} ${textDirection === 'rtl' ? 'text-right' : ''}`}
                        required
                    />
                </div>

                {/* Signature Area */}
                <div className="p-6 pt-0">
                    <h3 className="text-lg font-medium text-gray-700 mb-2">{T.signature_title}</h3>
                    <div
                        className={`relative border-2 border-dashed rounded-lg overflow-hidden shadow-inner ${isDisabled ? 'border-green-500 bg-green-50' : 'border-gray-400 bg-gray-50'}`}>
                        <canvas
                            ref={canvasRef}
                            className={`w-full h-48 ${isDisabled ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
                            style={{touchAction: 'none'}}
                            onMouseDown={startDrawing}
                            onMouseUp={endDrawing}
                            onMouseMove={draw}
                            onMouseLeave={endDrawing}
                            onTouchStart={startDrawing}
                            onTouchEnd={endDrawing}
                            onTouchMove={draw}
                        />
                        {/* Placeholder text if not yet drawn */}
                        {!isSigned && (
                            <div
                                className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-500 text-sm">
                                {T.signature_placeholder}
                            </div>
                        )}
                        {/* 3. UPDATED: Overlay for already signed document, using CheckCircle */}
                        {isDisabled && (
                            <div
                                className="absolute inset-0 flex items-center justify-center bg-green-100 bg-opacity-70 text-green-800 text-lg font-bold pointer-events-none">
                                <CheckCircle size={28} className="m-2"/>
                                {T.message_already_signed}
                            </div>
                        )}
                    </div>
                </div>

                {/* Message and Actions */}
                <div className={`p-6 pt-4 border-t border-gray-100 ${textDirection === 'rtl' ? 'text-right' : ''}`}>
                    {message && (
                        <div
                            // 2. UPDATED: Message box styling
                            className={`p-3 mb-4 rounded-lg text-sm font-semibold flex items-center ${message.includes(T.message_success.substring(0, 10)) ? 'bg-green-100 text-green-800' : message.includes(T.message_already_signed) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {message.includes(T.message_already_signed) && <CheckCircle size={20} className="m-2"/>}
                            {message}
                        </div>
                    )}

                    <div className="flex justify-between gap-4">
                        <button
                            onClick={clearSignature}
                            disabled={isDisabled}
                            className="px-6 py-3 bg-red-500 text-white font-semibold rounded-xl shadow-md hover:bg-red-600 transition duration-300 transform hover:scale-[1.01] flex-1 disabled:bg-gray-400 disabled:shadow-none"
                        >
                            {T.clear_button}
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isDisabled || !signerName || !isSigned || message.includes(T.message_sending)}
                            className="px-6 py-3 bg-green-500 text-white font-semibold rounded-xl shadow-lg hover:bg-green-600 transition duration-300 transform hover:scale-[1.01] flex-1 disabled:bg-gray-400 disabled:shadow-none"
                        >
                            {T.submit_button}
                        </button>
                    </div>

                    <p className="mt-4 text-xs text-gray-500 text-center">
                        {T.disclaimer}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default App;
