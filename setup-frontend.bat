@echo off
color 0B
cls
echo ========================================
echo  FRONTEND STRUCTURE - BLANK FILES
echo  Creating 150+ blank files
echo ========================================
echo.

REM ============================================
REM CREATE ALL DIRECTORIES
REM ============================================
echo [1/3] Creating directories...

mkdir frontend 2>nul
mkdir frontend\public\images\avatars 2>nul
mkdir frontend\public\icons 2>nul
mkdir frontend\public\fonts 2>nul

REM App directories
mkdir "frontend\src\app\(auth)\login" 2>nul
mkdir "frontend\src\app\(auth)\register" 2>nul
mkdir "frontend\src\app\(auth)\forgot-password" 2>nul
mkdir "frontend\src\app\(auth)\reset-password\[token]" 2>nul
mkdir "frontend\src\app\(auth)\verify-email\[token]" 2>nul
mkdir "frontend\src\app\(auth)\verify-otp" 2>nul

mkdir "frontend\src\app\(marketing)\about" 2>nul
mkdir "frontend\src\app\(marketing)\how-it-works" 2>nul
mkdir "frontend\src\app\(marketing)\packages" 2>nul
mkdir "frontend\src\app\(marketing)\contact" 2>nul
mkdir "frontend\src\app\(marketing)\faq" 2>nul

mkdir "frontend\src\app\(dashboard)\dashboard" 2>nul
mkdir "frontend\src\app\(dashboard)\wallet\deposit" 2>nul
mkdir "frontend\src\app\(dashboard)\wallet\withdraw" 2>nul
mkdir "frontend\src\app\(dashboard)\wallet\transfer" 2>nul
mkdir "frontend\src\app\(dashboard)\investments\packages" 2>nul
mkdir "frontend\src\app\(dashboard)\investments\[id]" 2>nul
mkdir "frontend\src\app\(dashboard)\investments\history" 2>nul
mkdir "frontend\src\app\(dashboard)\transactions\[id]" 2>nul
mkdir "frontend\src\app\(dashboard)\income\referral" 2>nul
mkdir "frontend\src\app\(dashboard)\income\level" 2>nul
mkdir "frontend\src\app\(dashboard)\income\binary" 2>nul
mkdir "frontend\src\app\(dashboard)\team\network" 2>nul
mkdir "frontend\src\app\(dashboard)\team\genealogy" 2>nul
mkdir "frontend\src\app\(dashboard)\profile\edit" 2>nul
mkdir "frontend\src\app\(dashboard)\profile\security" 2>nul
mkdir "frontend\src\app\(dashboard)\profile\kyc" 2>nul
mkdir "frontend\src\app\(dashboard)\notifications" 2>nul
mkdir "frontend\src\app\(dashboard)\support\create" 2>nul
mkdir "frontend\src\app\(dashboard)\support\[ticketId]" 2>nul

mkdir "frontend\src\app\(admin)\admin\users\[userId]\edit" 2>nul
mkdir "frontend\src\app\(admin)\admin\packages\create" 2>nul
mkdir "frontend\src\app\(admin)\admin\packages\[id]\edit" 2>nul
mkdir "frontend\src\app\(admin)\admin\investments\[id]" 2>nul
mkdir "frontend\src\app\(admin)\admin\transactions\[id]" 2>nul
mkdir "frontend\src\app\(admin)\admin\withdrawals\pending" 2>nul
mkdir "frontend\src\app\(admin)\admin\withdrawals\[id]" 2>nul
mkdir "frontend\src\app\(admin)\admin\kyc\pending" 2>nul
mkdir "frontend\src\app\(admin)\admin\kyc\[userId]" 2>nul
mkdir "frontend\src\app\(admin)\admin\income-control\referral" 2>nul
mkdir "frontend\src\app\(admin)\admin\income-control\level" 2>nul
mkdir "frontend\src\app\(admin)\admin\income-control\binary" 2>nul
mkdir "frontend\src\app\(admin)\admin\roi-control\daily" 2>nul
mkdir "frontend\src\app\(admin)\admin\roi-control\staking" 2>nul
mkdir "frontend\src\app\(admin)\admin\cron-jobs" 2>nul
mkdir "frontend\src\app\(admin)\admin\support-tickets\[ticketId]" 2>nul
mkdir "frontend\src\app\(admin)\admin\reports\financial" 2>nul
mkdir "frontend\src\app\(admin)\admin\reports\users" 2>nul
mkdir "frontend\src\app\(admin)\admin\reports\transactions" 2>nul
mkdir "frontend\src\app\(admin)\admin\audit-logs" 2>nul
mkdir "frontend\src\app\(admin)\admin\settings\general" 2>nul
mkdir "frontend\src\app\(admin)\admin\settings\security" 2>nul
mkdir "frontend\src\app\(admin)\admin\settings\notifications" 2>nul

mkdir frontend\src\app\api\test 2>nul

mkdir frontend\src\components\landing 2>nul
mkdir frontend\src\components\auth 2>nul
mkdir frontend\src\components\dashboard 2>nul
mkdir frontend\src\components\admin 2>nul
mkdir frontend\src\components\forms 2>nul
mkdir frontend\src\components\shared 2>nul
mkdir frontend\src\components\ui 2>nul

mkdir frontend\src\redux\slices 2>nul
mkdir frontend\src\redux\api 2>nul

mkdir frontend\src\lib 2>nul
mkdir frontend\src\hooks 2>nul
mkdir frontend\src\styles 2>nul
mkdir frontend\src\types 2>nul

echo Done!

REM ============================================
REM CREATE BLANK FILES
REM ============================================
echo [2/3] Creating blank files...

REM Root app files
type nul > frontend\src\app\layout.jsx
type nul > frontend\src\app\page.jsx
type nul > frontend\src\app\providers.jsx
type nul > frontend\src\app\globals.css
type nul > frontend\src\app\loading.jsx
type nul > frontend\src\app\error.jsx
type nul > frontend\src\app\not-found.jsx

REM Auth pages
type nul > "frontend\src\app\(auth)\layout.jsx"
type nul > "frontend\src\app\(auth)\login\page.jsx"
type nul > "frontend\src\app\(auth)\register\page.jsx"
type nul > "frontend\src\app\(auth)\forgot-password\page.jsx"
type nul > "frontend\src\app\(auth)\reset-password\[token]\page.jsx"
type nul > "frontend\src\app\(auth)\verify-email\[token]\page.jsx"
type nul > "frontend\src\app\(auth)\verify-otp\page.jsx"

REM Marketing pages
type nul > "frontend\src\app\(marketing)\layout.jsx"
type nul > "frontend\src\app\(marketing)\about\page.jsx"
type nul > "frontend\src\app\(marketing)\how-it-works\page.jsx"
type nul > "frontend\src\app\(marketing)\packages\page.jsx"
type nul > "frontend\src\app\(marketing)\contact\page.jsx"
type nul > "frontend\src\app\(marketing)\faq\page.jsx"

REM Dashboard pages
type nul > "frontend\src\app\(dashboard)\layout.jsx"
type nul > "frontend\src\app\(dashboard)\dashboard\page.jsx"
type nul > "frontend\src\app\(dashboard)\dashboard\loading.jsx"
type nul > "frontend\src\app\(dashboard)\wallet\page.jsx"
type nul > "frontend\src\app\(dashboard)\wallet\deposit\page.jsx"
type nul > "frontend\src\app\(dashboard)\wallet\withdraw\page.jsx"
type nul > "frontend\src\app\(dashboard)\wallet\transfer\page.jsx"
type nul > "frontend\src\app\(dashboard)\investments\page.jsx"
type nul > "frontend\src\app\(dashboard)\investments\packages\page.jsx"
type nul > "frontend\src\app\(dashboard)\investments\[id]\page.jsx"
type nul > "frontend\src\app\(dashboard)\investments\history\page.jsx"
type nul > "frontend\src\app\(dashboard)\transactions\page.jsx"
type nul > "frontend\src\app\(dashboard)\transactions\[id]\page.jsx"
type nul > "frontend\src\app\(dashboard)\income\page.jsx"
type nul > "frontend\src\app\(dashboard)\income\referral\page.jsx"
type nul > "frontend\src\app\(dashboard)\income\level\page.jsx"
type nul > "frontend\src\app\(dashboard)\income\binary\page.jsx"
type nul > "frontend\src\app\(dashboard)\team\page.jsx"
type nul > "frontend\src\app\(dashboard)\team\network\page.jsx"
type nul > "frontend\src\app\(dashboard)\team\genealogy\page.jsx"
type nul > "frontend\src\app\(dashboard)\profile\page.jsx"
type nul > "frontend\src\app\(dashboard)\profile\edit\page.jsx"
type nul > "frontend\src\app\(dashboard)\profile\security\page.jsx"
type nul > "frontend\src\app\(dashboard)\profile\kyc\page.jsx"
type nul > "frontend\src\app\(dashboard)\notifications\page.jsx"
type nul > "frontend\src\app\(dashboard)\support\page.jsx"
type nul > "frontend\src\app\(dashboard)\support\create\page.jsx"
type nul > "frontend\src\app\(dashboard)\support\[ticketId]\page.jsx"

REM Admin pages
type nul > "frontend\src\app\(admin)\layout.jsx"
type nul > "frontend\src\app\(admin)\admin\page.jsx"
type nul > "frontend\src\app\(admin)\admin\users\page.jsx"
type nul > "frontend\src\app\(admin)\admin\users\[userId]\page.jsx"
type nul > "frontend\src\app\(admin)\admin\users\[userId]\edit\page.jsx"
type nul > "frontend\src\app\(admin)\admin\packages\page.jsx"
type nul > "frontend\src\app\(admin)\admin\packages\create\page.jsx"
type nul > "frontend\src\app\(admin)\admin\packages\[id]\edit\page.jsx"
type nul > "frontend\src\app\(admin)\admin\investments\page.jsx"
type nul > "frontend\src\app\(admin)\admin\investments\[id]\page.jsx"
type nul > "frontend\src\app\(admin)\admin\transactions\page.jsx"
type nul > "frontend\src\app\(admin)\admin\transactions\[id]\page.jsx"
type nul > "frontend\src\app\(admin)\admin\withdrawals\page.jsx"
type nul > "frontend\src\app\(admin)\admin\withdrawals\pending\page.jsx"
type nul > "frontend\src\app\(admin)\admin\withdrawals\[id]\page.jsx"
type nul > "frontend\src\app\(admin)\admin\kyc\page.jsx"
type nul > "frontend\src\app\(admin)\admin\kyc\pending\page.jsx"
type nul > "frontend\src\app\(admin)\admin\kyc\[userId]\page.jsx"
type nul > "frontend\src\app\(admin)\admin\income-control\page.jsx"
type nul > "frontend\src\app\(admin)\admin\income-control\referral\page.jsx"
type nul > "frontend\src\app\(admin)\admin\income-control\level\page.jsx"
type nul > "frontend\src\app\(admin)\admin\income-control\binary\page.jsx"
type nul > "frontend\src\app\(admin)\admin\roi-control\page.jsx"
type nul > "frontend\src\app\(admin)\admin\roi-control\daily\page.jsx"
type nul > "frontend\src\app\(admin)\admin\roi-control\staking\page.jsx"
type nul > "frontend\src\app\(admin)\admin\cron-jobs\page.jsx"
type nul > "frontend\src\app\(admin)\admin\support-tickets\page.jsx"
type nul > "frontend\src\app\(admin)\admin\support-tickets\[ticketId]\page.jsx"
type nul > "frontend\src\app\(admin)\admin\reports\page.jsx"
type nul > "frontend\src\app\(admin)\admin\reports\financial\page.jsx"
type nul > "frontend\src\app\(admin)\admin\reports\users\page.jsx"
type nul > "frontend\src\app\(admin)\admin\reports\transactions\page.jsx"
type nul > "frontend\src\app\(admin)\admin\audit-logs\page.jsx"
type nul > "frontend\src\app\(admin)\admin\settings\page.jsx"
type nul > "frontend\src\app\(admin)\admin\settings\general\page.jsx"
type nul > "frontend\src\app\(admin)\admin\settings\security\page.jsx"
type nul > "frontend\src\app\(admin)\admin\settings\notifications\page.jsx"

REM API routes
type nul > frontend\src\app\api\test\route.js

REM Landing components
type nul > frontend\src\components\landing\Hero.jsx
type nul > frontend\src\components\landing\Features.jsx
type nul > frontend\src\components\landing\HowItWorks.jsx
type nul > frontend\src\components\landing\Packages.jsx
type nul > frontend\src\components\landing\Testimonials.jsx
type nul > frontend\src\components\landing\Stats.jsx
type nul > frontend\src\components\landing\FAQ.jsx
type nul > frontend\src\components\landing\TrustSection.jsx
type nul > frontend\src\components\landing\CallToAction.jsx

REM Auth components
type nul > frontend\src\components\auth\LoginForm.jsx
type nul > frontend\src\components\auth\RegisterForm.jsx
type nul > frontend\src\components\auth\ForgotPasswordForm.jsx
type nul > frontend\src\components\auth\ResetPasswordForm.jsx
type nul > frontend\src\components\auth\OTPInput.jsx

REM Dashboard components
type nul > frontend\src\components\dashboard\Overview.jsx
type nul > frontend\src\components\dashboard\StatsGrid.jsx
type nul > frontend\src\components\dashboard\StatCard.jsx
type nul > frontend\src\components\dashboard\RecentActivity.jsx
type nul > frontend\src\components\dashboard\QuickActions.jsx
type nul > frontend\src\components\dashboard\EarningsChart.jsx
type nul > frontend\src\components\dashboard\TransactionTable.jsx
type nul > frontend\src\components\dashboard\InvestmentCard.jsx
type nul > frontend\src\components\dashboard\PackageCard.jsx
type nul > frontend\src\components\dashboard\WalletCard.jsx
type nul > frontend\src\components\dashboard\IncomeBreakdown.jsx
type nul > frontend\src\components\dashboard\BinaryTreeVisualization.jsx
type nul > frontend\src\components\dashboard\ReferralLink.jsx
type nul > frontend\src\components\dashboard\TeamStats.jsx
type nul > frontend\src\components\dashboard\NetworkTable.jsx

REM Admin components
type nul > frontend\src\components\admin\AdminStats.jsx
type nul > frontend\src\components\admin\UsersTable.jsx
type nul > frontend\src\components\admin\UserDetails.jsx
type nul > frontend\src\components\admin\PackagesTable.jsx
type nul > frontend\src\components\admin\PackageForm.jsx
type nul > frontend\src\components\admin\TransactionsTable.jsx
type nul > frontend\src\components\admin\WithdrawalQueue.jsx
type nul > frontend\src\components\admin\ApprovalModal.jsx
type nul > frontend\src\components\admin\KYCReview.jsx
type nul > frontend\src\components\admin\ROISettings.jsx
type nul > frontend\src\components\admin\IncomeSettings.jsx
type nul > frontend\src\components\admin\CronJobList.jsx
type nul > frontend\src\components\admin\ManualTrigger.jsx
type nul > frontend\src\components\admin\SystemHealth.jsx

REM Form components
type nul > frontend\src\components\forms\InvestmentForm.jsx
type nul > frontend\src\components\forms\DepositForm.jsx
type nul > frontend\src\components\forms\WithdrawForm.jsx
type nul > frontend\src\components\forms\TransferForm.jsx
type nul > frontend\src\components\forms\ProfileForm.jsx
type nul > frontend\src\components\forms\BankDetailsForm.jsx
type nul > frontend\src\components\forms\KYCUploadForm.jsx
type nul > frontend\src\components\forms\TicketForm.jsx
type nul > frontend\src\components\forms\PasswordChangeForm.jsx

REM Shared components
type nul > frontend\src\components\shared\Navbar.jsx
type nul > frontend\src\components\shared\Footer.jsx
type nul > frontend\src\components\shared\Sidebar.jsx
type nul > frontend\src\components\shared\DashboardLayout.jsx
type nul > frontend\src\components\shared\AdminSidebar.jsx
type nul > frontend\src\components\shared\ProtectedRoute.jsx
type nul > frontend\src\components\shared\LoadingSpinner.jsx
type nul > frontend\src\components\shared\ErrorBoundary.jsx
type nul > frontend\src\components\shared\Modal.jsx
type nul > frontend\src\components\shared\Toast.jsx
type nul > frontend\src\components\shared\Pagination.jsx
type nul > frontend\src\components\shared\SearchBar.jsx
type nul > frontend\src\components\shared\FilterBar.jsx
type nul > frontend\src\components\shared\DataTable.jsx
type nul > frontend\src\components\shared\EmptyState.jsx
type nul > frontend\src\components\shared\ConfirmDialog.jsx

REM UI components
type nul > frontend\src\components\ui\button.jsx
type nul > frontend\src\components\ui\input.jsx
type nul > frontend\src\components\ui\card.jsx
type nul > frontend\src\components\ui\dialog.jsx
type nul > frontend\src\components\ui\dropdown-menu.jsx
type nul > frontend\src\components\ui\table.jsx
type nul > frontend\src\components\ui\toast.jsx
type nul > frontend\src\components\ui\select.jsx
type nul > frontend\src\components\ui\badge.jsx
type nul > frontend\src\components\ui\tabs.jsx
type nul > frontend\src\components\ui\accordion.jsx
type nul > frontend\src\components\ui\alert.jsx
type nul > frontend\src\components\ui\avatar.jsx
type nul > frontend\src\components\ui\checkbox.jsx
type nul > frontend\src\components\ui\label.jsx
type nul > frontend\src\components\ui\separator.jsx
type nul > frontend\src\components\ui\skeleton.jsx
type nul > frontend\src\components\ui\switch.jsx
type nul > frontend\src\components\ui\textarea.jsx
type nul > frontend\src\components\ui\tooltip.jsx

REM Redux files
type nul > frontend\src\redux\store.js
type nul > frontend\src\redux\hooks.js
type nul > frontend\src\redux\slices\authSlice.js
type nul > frontend\src\redux\slices\walletSlice.js
type nul > frontend\src\redux\slices\investmentSlice.js
type nul > frontend\src\redux\slices\transactionSlice.js
type nul > frontend\src\redux\slices\incomeSlice.js
type nul > frontend\src\redux\slices\notificationSlice.js
type nul > frontend\src\redux\slices\uiSlice.js
type nul > frontend\src\redux\api\apiSlice.js
type nul > frontend\src\redux\api\authApi.js
type nul > frontend\src\redux\api\walletApi.js
type nul > frontend\src\redux\api\investmentApi.js
type nul > frontend\src\redux\api\transactionApi.js
type nul > frontend\src\redux\api\incomeApi.js
type nul > frontend\src\redux\api\withdrawalApi.js
type nul > frontend\src\redux\api\kycApi.js
type nul > frontend\src\redux\api\notificationApi.js
type nul > frontend\src\redux\api\supportApi.js
type nul > frontend\src\redux\api\userApi.js
type nul > frontend\src\redux\api\adminApi.js

REM Lib files
type nul > frontend\src\lib\axios.js
type nul > frontend\src\lib\utils.js
type nul > frontend\src\lib\constants.js
type nul > frontend\src\lib\formatters.js
type nul > frontend\src\lib\validators.js
type nul > frontend\src\lib\cn.js

REM Hooks
type nul > frontend\src\hooks\useAuth.js
type nul > frontend\src\hooks\useWallet.js
type nul > frontend\src\hooks\useInvestment.js
type nul > frontend\src\hooks\useNotification.js
type nul > frontend\src\hooks\useDebounce.js
type nul > frontend\src\hooks\useLocalStorage.js
type nul > frontend\src\hooks\useMediaQuery.js

REM Styles
type nul > frontend\src\styles\.gitkeep

REM Types
type nul > frontend\src\types\user.types.ts
type nul > frontend\src\types\wallet.types.ts
type nul > frontend\src\types\investment.types.ts
type nul > frontend\src\types\api.types.ts

REM Public files
type nul > frontend\public\images\.gitkeep
type nul > frontend\public\images\avatars\.gitkeep
type nul > frontend\public\icons\.gitkeep
type nul > frontend\public\fonts\.gitkeep

echo Done!

REM ============================================
REM CREATE CONFIG FILES
REM ============================================
echo [3/3] Creating config files...

type nul > frontend\package.json
type nul > frontend\next.config.js
type nul > frontend\tailwind.config.js
type nul > frontend\postcss.config.js
type nul > frontend\tsconfig.json
type nul > frontend\.eslintrc.json
type nul > frontend\components.json
type nul > frontend\.gitignore
type nul > frontend\.env.local.example

echo Done!

echo.
echo ========================================
echo  COMPLETE!
echo ========================================
echo.
echo  Directories: 100+
echo  Blank Files: 150+
echo.
echo  Structure created successfully!
echo.
echo Next Steps:
echo  1. cd frontend
echo  2. Fill config files
echo  3. npm install
echo  4. npm run dev
echo.
pause
