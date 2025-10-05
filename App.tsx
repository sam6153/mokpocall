import React from 'react';
import Dashboard from './components/Dashboard';
import ScheduleManager from './components/ScheduleManager';
import DriverManager from './components/DriverManager';
import VehicleManager from './components/VehicleManager';
import WorkTeamManager from './components/WorkHourManager';
import DataManager from './components/DataManager';
import Modal from './components/Modal';
import { useData } from './hooks/useData';
import type { Tab, DataSource } from './types';
import { initGapiClient, handleSignIn, handleSignOut, listSpreadsheets } from './services/dbService';
import { MenuIcon } from './components/icons/Icons';

const TABS: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: '근무현황' },
    { id: 'schedules', label: '근무표 관리' },
    { id: 'drivers', label: '운전자 관리' },
    { id: 'vehicles', label: '차량 관리' },
    { id: 'workTeams', label: '근무조 관리' },
    { id: 'data', label: '데이터 관리' },
];

const normalTabs = TABS.filter(t => ['dashboard', 'schedules'].includes(t.id));
const adminTabs = TABS; // Admins can see all tabs

const App: React.FC = () => {
    const [activeTab, setActiveTab] = React.useState<Tab>('dashboard');
    const [isAdmin, setIsAdmin] = React.useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = React.useState(false);
    const [passwordInput, setPasswordInput] = React.useState('');
    const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
    
    const [dataSource, setDataSource] = React.useState<DataSource | null>(() => {
        return localStorage.getItem('dataSource') as DataSource | null;
    });

    const [config, setConfig] = React.useState(() => {
        const savedConfig = localStorage.getItem('googleSheetsConfig');
        return savedConfig ? JSON.parse(savedConfig) : { apiKey: '', clientId: '', spreadsheetId: '' };
    });

    const [authStatus, setAuthStatus] = React.useState({ isInitializing: true, isSignedIn: false });
    const [authError, setAuthError] = React.useState<string | null>(null);
    const [copied, setCopied] = React.useState(false);
    
    React.useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 640) { // sm breakpoint
                setIsMobileMenuOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    React.useEffect(() => {
        if (dataSource !== 'googleSheets') {
            setAuthStatus({ isInitializing: false, isSignedIn: false });
            return;
        }

        const loadGapi = async () => {
            const checkGapi = async () => {
                if (window.gapi) {
                    if (config.apiKey && config.clientId) {
                       setAuthError(null);
                        initGapiClient(config.apiKey, config.clientId, setAuthStatus).catch((err: Error) => {
                           setAuthError(err.message);
                        });
                    } else {
                        setAuthStatus({ isInitializing: false, isSignedIn: false });
                    }
                } else {
                    setTimeout(checkGapi, 100);
                }
            };
            checkGapi();
        };
        loadGapi();
    }, [config.apiKey, config.clientId, dataSource]);

    const { 
        data, 
        loading, 
        error,
        actions 
    } = useData({ config, authStatus, dataSource });
    
    const handleDataSourceSelect = (source: DataSource) => {
        localStorage.setItem('dataSource', source);
        setDataSource(source);
    };

    const handleAdminLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordInput === 'admin1234') {
            setIsAdmin(true);
            setActiveTab('drivers');
            setIsPasswordModalOpen(false);
            setPasswordInput('');
        } else {
            alert('비밀번호가 틀렸습니다.');
            setPasswordInput('');
        }
    }
    
    const handleSettingsSave = (settings: {
        dataSource: DataSource;
        config: { apiKey: string; clientId: string; spreadsheetId: string; }
    }) => {
        const { dataSource: newDataSource, config: newConfig } = settings;
        const oldDataSource = dataSource;

        localStorage.setItem('dataSource', newDataSource);
        localStorage.setItem('googleSheetsConfig', JSON.stringify(newConfig));
        
        setIsSettingsOpen(false);

        // A reload is required to re-initialize hooks and services with the new settings.
        if (
            newDataSource !== oldDataSource ||
            config.apiKey !== newConfig.apiKey ||
            config.clientId !== newConfig.clientId ||
            config.spreadsheetId !== newConfig.spreadsheetId
        ) {
            window.location.reload();
        } else {
            setConfig(newConfig);
            setDataSource(newDataSource);
        }
    };

    const handleResetSettings = () => {
        if (window.confirm('모든 설정을 초기화하고 데이터 저장 방식 선택 화면으로 돌아가시겠습니까? 입력한 API 키와 스프레드시트 정보가 삭제됩니다.')) {
            localStorage.removeItem('dataSource');
            localStorage.removeItem('googleSheetsConfig');
            window.location.reload();
        }
    };

    const handleLogout = () => {
        setIsAdmin(false);
        setActiveTab('dashboard');
    }

    const tabsToDisplay = isAdmin ? adminTabs : normalTabs;
    const canManage = dataSource === 'local' || (dataSource === 'googleSheets' && authStatus.isSignedIn);

    const renderContent = React.useCallback(() => {
        if (dataSource === 'googleSheets') {
            if (!config.apiKey || !config.clientId) {
                return (
                    <div className="text-center p-8 bg-blue-50 rounded-lg">
                        <h3 className="text-xl font-semibold text-blue-800">Google Sheets 연동 시작하기</h3>
                        <p className="text-blue-700 mt-2">데이터를 안전하게 저장하고 팀과 공유하려면 Google Sheets 연동을 설정하세요.</p>
                        <div className="mt-6 flex flex-col sm:flex-row justify-center items-center gap-4">
                            <button onClick={() => setIsSettingsOpen(true)} className="w-full sm:w-auto bg-blue-500 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-600 transition-colors text-lg">
                                연동 설정 시작
                            </button>
                             <button onClick={handleResetSettings} className="w-full sm:w-auto bg-slate-500 text-white font-bold py-3 px-8 rounded-lg hover:bg-slate-600 transition-colors text-lg">
                                뒤로가기
                            </button>
                        </div>
                    </div>
                );
            }
            
             if (authError) {
                if (authError.includes('AUTH_ERROR: Client ID')) {
                     return (
                        <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200">
                            <h3 className="text-xl font-semibold text-red-800">Google 연동 오류 (Invalid Client)</h3>
                            <p className="text-red-700 mt-2">Client ID가 올바르지 않거나 Google Cloud Console에서 제대로 설정되지 않았습니다.</p>
                            <div className="text-sm text-gray-600 mt-4 text-left bg-gray-50 p-4 rounded-md">
                                <strong className="font-semibold">해결 방법:</strong>
                                <ol className="list-decimal list-inside mt-2 space-y-1">
                                    <li>Google Cloud Console에서 OAuth 2.0 클라이언트 ID를 다시 확인하고 복사해주세요.</li>
                                    <li>아래 버튼을 눌러 '설정'을 열고, 올바른 Client ID와 API Key를 입력해주세요.</li>
                                </ol>
                            </div>
                            <div className="mt-6 flex justify-center gap-4">
                                <button onClick={() => setIsSettingsOpen(true)} className="bg-red-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-600 transition-colors">
                                    설정 열기
                                </button>
                                <button onClick={handleResetSettings} className="bg-gray-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-gray-600 transition-colors">
                                    초기 설정으로 돌아가기
                                </button>
                            </div>
                        </div>
                    );
                }
                if (authError.startsWith('AUTH_ERROR: ORIGIN_MISMATCH:')) {
                    const origin = authError.split(': ')[2];
                    return (
                        <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200">
                            <h3 className="text-xl font-semibold text-red-800">Google 연동 오류 (잘못된 Origin)</h3>
                            <p className="text-red-700 mt-2">앱의 현재 주소가 Google Cloud 프로젝트에 등록되지 않았습니다.</p>
                            <div className="text-sm text-gray-600 mt-4 text-left bg-gray-50 p-4 rounded-md">
                                <strong className="font-semibold">해결 방법:</strong>
                                <ol className="list-decimal list-inside mt-2 space-y-2">
                                    <li>
                                        <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                            Google Cloud Console 자격증명 페이지
                                        </a>
                                        로 이동하세요.
                                    </li>
                                    <li>사용 중인 'OAuth 2.0 클라이언트 ID'를 선택하세요.</li>
                                    <li>'승인된 자바스크립트 원본' 섹션에서 <strong>+ URI 추가</strong> 버튼을 클릭하세요.</li>
                                    <li>아래 주소를 복사하여 붙여넣고 저장하세요:
                                        <div className="mt-2 flex items-center gap-2 bg-white p-2 rounded border">
                                            <input type="text" readOnly value={origin} className="font-mono text-xs w-full bg-transparent outline-none"/>
                                            <button 
                                                onClick={() => {
                                                    navigator.clipboard.writeText(origin);
                                                    setCopied(true);
                                                    setTimeout(() => setCopied(false), 2000);
                                                }} 
                                                className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded w-16 text-center"
                                            >
                                                {copied ? '복사됨!' : '복사'}
                                            </button>
                                        </div>
                                    </li>
                                    <li>설정을 저장한 후, 이 페이지를 새로고침 해주세요.</li>
                                </ol>
                            </div>
                             <div className="mt-6 flex justify-center gap-4 flex-wrap">
                                 <button onClick={() => window.location.reload()} className="bg-blue-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-600 transition-colors">
                                    새로고침
                                </button>
                                <button onClick={() => setIsSettingsOpen(true)} className="bg-gray-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-gray-600 transition-colors">
                                    설정 열기
                                </button>
                                <button onClick={handleResetSettings} className="bg-gray-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-gray-600 transition-colors">
                                    초기 설정으로 돌아가기
                                </button>
                            </div>
                        </div>
                    );
                }
                return <div className="text-center text-red-500 p-8 bg-red-50 rounded-lg">{authError}</div>;
            }
            
            if (authStatus.isInitializing) {
                 return <div className="flex justify-center items-center h-96"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div><p className="ml-4 text-gray-600">Google 인증 초기화 중...</p></div>;
            }

            if (!authStatus.isSignedIn) {
                return (
                     <div className="text-center p-8 bg-blue-50 rounded-lg">
                        <h3 className="text-xl font-semibold text-blue-800">로그인 필요</h3>
                        <p className="text-blue-700 mt-2">데이터를 보거나 수정하려면 Google 계정으로 로그인해야 합니다.</p>
                        <div className="mt-4 flex flex-col sm:flex-row justify-center items-center gap-4">
                            <button onClick={handleSignIn} className="w-full sm:w-auto bg-blue-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-600 transition-colors">
                                Google 계정으로 로그인
                            </button>
                             <button onClick={handleResetSettings} className="w-full sm:w-auto bg-gray-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-gray-600 transition-colors">
                                뒤로가기
                            </button>
                        </div>
                    </div>
                );
            }
            
            if (authStatus.isSignedIn && !config.spreadsheetId) {
                return (
                    <div className="text-center p-8 bg-green-50 rounded-lg">
                        <h3 className="text-xl font-semibold text-green-800">마지막 단계!</h3>
                        <p className="text-green-700 mt-2">사용할 Google Sheet를 선택해주세요.</p>
                        <div className="mt-6 flex flex-col sm:flex-row justify-center items-center gap-4">
                            <button onClick={() => setIsSettingsOpen(true)} className="w-full sm:w-auto bg-green-500 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-600 transition-colors">
                                스프레드시트 선택하기
                            </button>
                            <button onClick={handleResetSettings} className="w-full sm:w-auto bg-gray-500 text-white font-bold py-3 px-8 rounded-lg hover:bg-gray-600 transition-colors">
                                뒤로가기
                            </button>
                        </div>
                    </div>
                );
            }
        }


        if (loading) {
            return <div className="flex justify-center items-center h-96"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div><p className="ml-4 text-gray-600">데이터 불러오는 중...</p></div>;
        }
        if (error) {
            return <div className="text-center text-red-500 p-8 bg-red-50 rounded-lg">{error}</div>;
        }

        switch (activeTab) {
            case 'dashboard':
                return <Dashboard data={data} />;
            case 'schedules':
                return <ScheduleManager schedules={data.schedules} drivers={data.drivers} vehicles={data.vehicles} workTeams={data.workTeams} actions={actions} isAdmin={isAdmin} />;
            case 'drivers':
                return isAdmin ? <DriverManager drivers={data.drivers} actions={actions} /> : null;
            case 'vehicles':
                return isAdmin ? <VehicleManager vehicles={data.vehicles} actions={actions} /> : null;
            case 'workTeams':
                return isAdmin ? <WorkTeamManager workTeams={data.workTeams} actions={actions} /> : null;
            case 'data':
                 return isAdmin ? <DataManager 
                    currentConfig={config} 
                    dataSource={dataSource} 
                    data={data}
                /> : null;
            default:
                return null;
        }
    }, [activeTab, data, loading, error, actions, isAdmin, config, authStatus, dataSource, authError, copied]);

    const tabsDisabled = loading || (dataSource === 'googleSheets' && (!authStatus.isSignedIn || !config.spreadsheetId || !!authError));
    
    const tabButtons = React.useMemo(() => tabsToDisplay.map(tab => (
        <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-3 px-4 sm:py-4 sm:px-6 cursor-pointer border-b-4 text-sm sm:text-base font-semibold transition-all duration-300 ease-in-out whitespace-nowrap ${
                activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-800'
            } ${tabsDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
             disabled={tabsDisabled}
        >
            {tab.label}
        </button>
    )), [activeTab, tabsToDisplay, tabsDisabled]);
    
    if (!dataSource) {
        return (
            <div className="p-8 min-h-screen flex items-center justify-center bg-slate-100">
                <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-lg text-center">
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">목포콜 통합 관리 시스템 🚕</h1>
                    <p className="text-gray-600 mb-8">시작하려면 데이터 저장 방식을 선택하세요.</p>
                    <div className="space-y-4">
                        <button 
                            onClick={() => handleDataSourceSelect('googleSheets')}
                            className="w-full bg-blue-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-600 transition-colors text-lg"
                        >
                            Google Sheets 사용
                        </button>
                        <button 
                            onClick={() => handleDataSourceSelect('local')}
                            className="w-full bg-slate-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-slate-700 transition-colors text-lg"
                        >
                            로컬 데이터 사용 (간편 모드)
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-6 text-left leading-relaxed">
                        <strong>Google Sheets:</strong> 실시간 공유 및 영구 데이터 저장을 위해 Google 계정이 필요합니다. API 설정이 필요할 수 있습니다.<br/><br/>
                        <strong>로컬 데이터:</strong> 별도 설정 없이 브라우저에 데이터를 저장하여 바로 사용할 수 있습니다. 데이터는 현재 사용 중인 기기와 브라우저에만 저장됩니다.
                    </p>
                </div>
            </div>
        );
    }

    const renderHeaderActions = () => (
        <>
            {isAdmin && (
                <button 
                    onClick={() => { setIsSettingsOpen(true); setIsMobileMenuOpen(false); }}
                    className="w-full text-left bg-transparent text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-100 transition-colors whitespace-nowrap text-sm"
                >
                    설정
                </button>
            )}
            {dataSource === 'googleSheets' && authStatus.isSignedIn ? (
                 <button onClick={() => { handleSignOut(); setIsMobileMenuOpen(false); }} className="w-full text-left bg-transparent text-red-600 font-semibold py-2 px-4 rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap text-sm">로그아웃</button>
            ) : null}
             <button 
                onClick={() => {
                    isAdmin ? handleLogout() : setIsPasswordModalOpen(true);
                    setIsMobileMenuOpen(false);
                }}
                className="w-full text-left bg-transparent text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-100 transition-colors whitespace-nowrap text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!canManage}
            >
                {isAdmin ? '일반 모드' : '관리자 모드'}
            </button>
        </>
    );

    return (
        <div className="p-2 sm:p-4 md:p-6">
            <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-lg min-h-screen">
                <header className="p-4 sm:p-6 border-b-2 border-gray-100">
                    <div className="relative text-center sm:text-left">
                        <h1 className="text-xl sm:text-3xl font-bold text-gray-800">목포콜 통합 관리 시스템 🚕</h1>
                        <p className="text-xs sm:text-base text-gray-500 mt-1">
                            {dataSource === 'googleSheets' ? 'Google Sheets 연동 모드' : '로컬 데이터 모드'}
                        </p>
                         <div className="absolute top-0 right-0 h-full flex items-center">
                            {/* Desktop Buttons */}
                            <div className="hidden sm:flex items-center space-x-2">
                                {isAdmin && (
                                    <button onClick={() => setIsSettingsOpen(true)} className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors text-sm">설정</button>
                                )}
                                {dataSource === 'googleSheets' && authStatus.isSignedIn ? (
                                    <button onClick={handleSignOut} className="bg-red-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-600 transition-colors text-sm">로그아웃</button>
                                ) : null}
                                <button onClick={isAdmin ? handleLogout : () => setIsPasswordModalOpen(true)} className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors text-sm disabled:opacity-50" disabled={!canManage}>
                                    {isAdmin ? '일반 모드' : '관리자 모드'}
                                </button>
                            </div>
                             {/* Mobile Menu */}
                            <div className="sm:hidden">
                                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-gray-500 hover:text-gray-800">
                                    <MenuIcon />
                                </button>
                                {isMobileMenuOpen && (
                                    <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-md shadow-lg border z-20">
                                        <div className="p-1">
                                            {renderHeaderActions()}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <nav className="mt-6">
                        <div className="relative">
                           <div className="flex overflow-x-auto scrollbar-hide border-b border-gray-200">
                                {tabButtons}
                           </div>
                        </div>
                    </nav>
                </header>

                <main className="p-4 sm:p-6">
                    {renderContent()}
                </main>
            </div>
             <Modal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} title="관리자 비밀번호 입력">
                <form onSubmit={handleAdminLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">비밀번호</label>
                        <input 
                            type="password" 
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                            autoFocus
                        />
                    </div>
                    <div className="flex justify-end pt-2">
                        <button type="submit" className="bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors">로그인</button>
                    </div>
                </form>
            </Modal>
             <SettingsModal 
                isOpen={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)} 
                currentConfig={config}
                currentDataSource={dataSource}
                onSave={handleSettingsSave}
                authStatus={authStatus}
            />
        </div>
    );
};

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentConfig: { apiKey: string; clientId: string; spreadsheetId: string; };
    currentDataSource: DataSource | null;
    onSave: (settings: { dataSource: DataSource; config: { apiKey: string; clientId: string; spreadsheetId: string; }}) => void;
    authStatus: { isSignedIn: boolean };
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, currentConfig, currentDataSource, onSave, authStatus }) => {
    const [settings, setSettings] = React.useState(currentConfig);
    const [selectedDataSource, setSelectedDataSource] = React.useState(currentDataSource);
    const [isPickerOpen, setIsPickerOpen] = React.useState(false);

    React.useEffect(() => {
        setSettings(currentConfig);
        setSelectedDataSource(currentDataSource);
    }, [currentConfig, currentDataSource, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSettings({ ...settings, [e.target.name]: e.target.value });
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (selectedDataSource && selectedDataSource !== currentDataSource) {
            const confirmMsg = selectedDataSource === 'local'
                ? 'Google Sheets 연동을 중단하고 로컬 데이터 모드로 전환하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 앞으로는 이 브라우저에만 데이터가 저장됩니다.'
                : '로컬 데이터 사용을 중단하고 Google Sheets 연동 모드로 전환하시겠습니까?\n\n브라우저에 저장된 데이터는 유지되지만, 앱은 Google Sheets를 기준으로 동작하게 됩니다.';
            if (!window.confirm(confirmMsg)) {
                return; 
            }
        }
        
        if (!selectedDataSource) return;

        onSave({ dataSource: selectedDataSource, config: settings });
    };
    
    const handleSheetSelect = (sheet: {id: string, name: string}) => {
        setSettings({...settings, spreadsheetId: sheet.id});
        setIsPickerOpen(false);
    }

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title="설정">
                 <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">데이터 저장 방식</label>
                        <div className="mt-2 flex rounded-md shadow-sm">
                             <button type="button" onClick={() => setSelectedDataSource('googleSheets')} className={`px-4 py-2 border rounded-l-md w-1/2 text-sm font-medium transition-colors ${selectedDataSource === 'googleSheets' ? 'bg-blue-600 text-white border-blue-600 z-10' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                                Google Sheets
                            </button>
                            <button type="button" onClick={() => setSelectedDataSource('local')} className={`px-4 py-2 border rounded-r-md w-1/2 text-sm font-medium transition-colors -ml-px ${selectedDataSource === 'local' ? 'bg-blue-600 text-white border-blue-600 z-10' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                                로컬 (브라우저)
                            </button>
                        </div>
                    </div>

                    {selectedDataSource === 'googleSheets' && (
                        <div className="space-y-4 border-t pt-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">API Key</label>
                                <input type="text" name="apiKey" value={settings.apiKey} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-md" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Client ID</label>
                                <input type="text" name="clientId" value={settings.clientId} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-md" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Spreadsheet ID</label>
                                <div className="flex gap-2 mt-1">
                                    <input 
                                        type="text" 
                                        name="spreadsheetId" 
                                        value={settings.spreadsheetId} 
                                        onChange={handleChange} 
                                        className="block w-full p-2 border rounded-md" 
                                        required 
                                        placeholder="여기에 ID를 붙여넣거나 찾아보기"
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => setIsPickerOpen(true)}
                                        className="bg-gray-200 text-gray-700 font-semibold px-4 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                        disabled={!authStatus.isSignedIn}
                                        title={!authStatus.isSignedIn ? "먼저 로그인해야 합니다." : "Google Drive에서 스프레드시트 찾기"}
                                    >
                                        찾아보기
                                    </button>
                                </div>
                            </div>
                            <div className="pt-2 text-xs text-gray-500">
                                <p>API Key와 Client ID는 Google Cloud Console에서 생성할 수 있습니다. Spreadsheet ID는 Google Sheet URL에서 확인할 수 있습니다.</p>
                                <p className="mt-1"> (e.g., .../spreadsheets/d/<strong className="text-red-500">SPREADSHEET_ID</strong>/edit...)</p>
                            </div>
                        </div>
                    )}
                     {selectedDataSource === 'local' && (
                         <div className="space-y-4 border-t pt-6">
                            <p className="text-sm text-gray-600">
                                데이터가 현재 사용 중인 브라우저에 저장됩니다. 다른 기기나 브라우저와 동기화되지 않습니다.
                                데이터를 안전하게 보관하려면 '데이터 관리' 탭에서 정기적으로 백업하세요.
                            </p>
                        </div>
                    )}
                    <div className="flex justify-end pt-2">
                        <button type="submit" className="bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors">저장 및 새로고침</button>
                    </div>
                </form>
            </Modal>
            <SpreadsheetPickerModal 
                isOpen={isPickerOpen}
                onClose={() => setIsPickerOpen(false)}
                onSelect={handleSheetSelect}
            />
        </>
    );
};

interface Sheet {
    id: string;
    name: string;
}

interface SpreadsheetPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (sheet: Sheet) => void;
}

const SpreadsheetPickerModal: React.FC<SpreadsheetPickerModalProps> = ({ isOpen, onClose, onSelect }) => {
    const [sheets, setSheets] = React.useState<Sheet[]>([]);
    const [filteredSheets, setFilteredSheets] = React.useState<Sheet[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [searchTerm, setSearchTerm] = React.useState('');

    React.useEffect(() => {
        if (isOpen) {
            setLoading(true);
            setError(null);
            setSearchTerm('');
            listSpreadsheets()
                .then(data => {
                    setSheets(data);
                    setFilteredSheets(data);
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Failed to fetch spreadsheets", err);
                    setError("스프레드시트 목록을 불러오는 데 실패했습니다. Google Drive API 권한을 확인해주세요.");
                    setLoading(false);
                });
        }
    }, [isOpen]);

    React.useEffect(() => {
        if (!searchTerm) {
            setFilteredSheets(sheets);
        } else {
            const lowercasedFilter = searchTerm.toLowerCase();
            setFilteredSheets(
                sheets.filter(sheet => sheet.name.toLowerCase().includes(lowercasedFilter))
            );
        }
    }, [searchTerm, sheets]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="스프레드시트 선택">
            <div className="space-y-4">
                <div className="flex justify-between items-center gap-4">
                    <input
                        type="search"
                        placeholder="이름으로 검색..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="p-2 border rounded-md w-full"
                        autoFocus
                    />
                     <a href="https://sheets.new" target="_blank" rel="noopener noreferrer" className="bg-green-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-600 transition-colors whitespace-nowrap">
                        새로 만들기
                    </a>
                </div>
                 <div className="border rounded-md max-h-80 overflow-y-auto">
                    {loading && <p className="p-4 text-center text-gray-500">불러오는 중...</p>}
                    {error && <p className="p-4 text-center text-red-500">{error}</p>}
                    {!loading && !error && filteredSheets.length === 0 && (
                        <p className="p-4 text-center text-gray-500">{searchTerm ? "검색 결과가 없습니다." : "스프레드시트를 찾을 수 없습니다."}</p>
                    )}
                    {!loading && !error && filteredSheets.map(sheet => (
                        <button
                            key={sheet.id}
                            onClick={() => onSelect(sheet)}
                            className="block w-full text-left p-3 hover:bg-blue-50 border-b last:border-b-0 transition-colors"
                        >
                            <p className="font-medium text-gray-800 truncate">{sheet.name}</p>
                            <p className="text-xs text-gray-500 font-mono mt-1 truncate">{sheet.id}</p>
                        </button>
                    ))}
                </div>
            </div>
        </Modal>
    );
}

export default App;