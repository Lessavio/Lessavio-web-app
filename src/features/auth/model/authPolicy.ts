export function accountScope(projectId:string,uid:string):string {
 if(!/^[A-Za-z0-9_-]+$/.test(projectId)||!/^[A-Za-z0-9_-]+$/.test(uid))throw new Error('Invalid account identity');
 return `firebase:${projectId}:${uid}`;
}
export function authErrorKey(error:unknown):string {
 const code=typeof error==='object'&&error!==null&&'code' in error?String(error.code):'';
 switch(code){
  case 'auth/google-not-configured':return 'Вход через Google пока недоступен в этой сборке.';
  case 'auth/popup-closed-by-user':case 'auth/cancelled-popup-request':case 'auth/google-cancelled':return 'Вход отменён. Можно попробовать снова';
  case 'auth/popup-blocked':return 'Браузер заблокировал окно входа. Разрешите всплывающие окна';
  case 'auth/google-timeout':return 'Время ожидания входа истекло. Попробуйте снова';
  case 'auth/account-exists-with-different-credential':return 'Этот email уже связан с другим способом входа. Используйте его';
  case 'auth/google-failed':return 'Не удалось войти через Google. Попробуйте снова';
  case 'auth/invalid-email':return 'Введите корректный email';
  case 'auth/email-already-in-use':return 'Этот email уже используется';
  case 'auth/weak-password':case 'auth/password-does-not-meet-requirements':return 'Пароль не соответствует требованиям Firebase';
  case 'auth/invalid-credential':case 'auth/wrong-password':case 'auth/user-not-found':return 'Неверный email или пароль';
  case 'auth/user-disabled':return 'Этот аккаунт отключён';
  case 'auth/too-many-requests':return 'Слишком много попыток. Попробуйте позже';
  case 'auth/network-request-failed':return 'Для этого действия нужен интернет';
  case 'auth/operation-not-allowed':return 'Вход по email пока не включён администратором';
  case 'auth/unauthorized-domain':return 'Этот домен не разрешён для входа через Google. Для локального запуска откройте приложение на localhost. Для опубликованного сайта добавьте домен в Firebase Authentication → Settings → Authorized domains.';
  case 'auth/invalid-api-key':case 'auth/app-not-authorized':return 'Неверная конфигурация Firebase. Обратитесь к разработчику';
  default:return 'Не удалось выполнить действие с аккаунтом. Попробуйте снова';
 }
}
