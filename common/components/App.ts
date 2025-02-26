import { AppURL, handleOpenURL } from '@nativescript-community/appurl';
import * as EInfo from '@nativescript-community/extendedinfo';
import * as perms from '@nativescript-community/perms';
// import { Message, registerForPushNotifications } from '@nativescript-community/push';
import { confirm, login } from '@nativescript-community/ui-material-dialogs';
import { showSnack } from '@nativescript-community/ui-material-snackbar';
import { TextField } from '@nativescript-community/ui-material-textfield';
import { CSSUtils, Device, Frame, GridLayout, Observable, Page, Screen, StackLayout, View } from '@nativescript/core';
import {
    AndroidActivityResultEventData,
    AndroidApplication,
    ApplicationEventData,
    android as androidApp,
    off as applicationOff,
    on as applicationOn,
    getNativeApplication,
    resumeEvent,
    suspendEvent
} from '@nativescript/core/application';
import { ad } from '@nativescript/core/utils/utils';
import { compose } from '@nativescript/email';
import { Drawer } from '@nativescript-community/ui-drawer';
import { Vibrate } from 'nativescript-vibrate';
import Vue, { NativeScriptVue, NativeScriptVueConstructor, NavigationEntryVue } from 'nativescript-vue';
import { Component } from 'vue-property-decorator';
import { VueConstructor } from 'vue/types/umd';
import { $t, $tc } from '../helpers/locale';
import { LoggedinEvent, LoggedoutEvent, UserProfile } from '../services/AuthService';
import { NetworkConnectionStateEvent, NetworkConnectionStateEventData, base64Encode } from '../services/NetworkService';
import { parseUrlScheme } from '../utils/urlscheme';
import { colorPrimary, screenHeightDips, screenWidthDips } from '../variables';
import BaseVueComponent, { BaseVueComponentRefs } from './BaseVueComponent';
import Floating from './Floating';
import Home from './Home';
import Map from './Map';
import TransferWindow from './TransferWindow';

const observable = new Observable();
export const QRCodeDataEvent = 'qrcodedata';
export const on = observable.on.bind(observable);
export const off = observable.off.bind(observable);

let drawerInstance: Drawer;
export function getDrawerInstance() {
    return drawerInstance;
}
export function setDrawerInstance(instance: Drawer) {
    drawerInstance = instance;
}

export interface AppRefs extends BaseVueComponentRefs {
    [key: string]: any;
    innerFrame: NativeScriptVue<Frame>;
    menu: NativeScriptVue<StackLayout>;
    drawer: Drawer;
}

export enum ComponentIds {
    Login = 'login',
    Situation = 'situation',
    Profile = 'profile',
    Transfer = 'transfer',
    Map = 'map',
    Beneficiaries = 'beneficiaries',
    Settings = 'settings',
    About = 'about'
}
// Settings = 'settings',
// Pairing = 'pairing',
// History = 'history',
// Map = 'map'
export const navigateUrlProperty = 'navigateUrl';

const mailRegexp = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;

@Component({
    components: {
        Home,
        Map
    }
})
export default class App extends BaseVueComponent {
    $refs: AppRefs;
    mMessageReceiver: android.content.BroadcastReceiver;
    networkConnected = true;
    protected routes: { [k: string]: { component: Function | typeof Vue } } = {
        [ComponentIds.Situation]: {
            component: async () => (await import('~/common/components/Home')).default
        },
        [ComponentIds.Profile]: {
            component: async () => (await import('~/common/components/Profile')).default
        },
        [ComponentIds.Login]: {
            component: async () => (await import('~/common/components/Login')).default
        },
        [ComponentIds.Beneficiaries]: {
            component: async () => (await import('~/common/components/Beneficiaries')).default
        },
        [ComponentIds.Map]: {
            component: async () => (await import('~/common/components/Map')).default
        },
        [ComponentIds.Settings]: {
            component: async () => (await import('~/common/components/Settings')).default
        },
        [ComponentIds.About]: {
            component: async () => (await import('~/common/components/About')).default
        }
    };
    selectedTabIndex: number = 0;
    public activatedUrl = '';
    public loggedInOnStart = Vue.prototype.$authService.isLoggedIn();
    public currentlyLoggedIn = Vue.prototype.$authService.isLoggedIn();

    public appVersion: string;
    public userProfile: UserProfile = null;
    get drawer() {
        return this.getRef<Drawer>('drawer');
    }
    get innerFrame() {
        return this.$refs.innerFrame && this.$refs.innerFrame.nativeView;
    }
    get menuItems() {
        if (this.currentlyLoggedIn) {
            return [
                {
                    title: this.$t('situation'),
                    icon: 'mdi-bank',
                    url: ComponentIds.Situation
                },
                {
                    title: this.$t('profile'),
                    icon: 'mdi-account',
                    url: ComponentIds.Profile
                },
                {
                    title: this.$t('favorites'),
                    icon: 'mdi-account-group',
                    url: ComponentIds.Beneficiaries
                },
                {
                    title: this.$t('map'),
                    icon: 'mdi-map',
                    url: ComponentIds.Map
                },
                {
                    title: this.$t('settings'),
                    icon: 'mdi-settings',
                    url: ComponentIds.Settings
                },
                {
                    title: this.$t('about'),
                    icon: 'mdi-information-outline',
                    url: ComponentIds.About
                }
            ];
        } else {
            return [
                {
                    title: this.$t('map'),
                    icon: 'mdi-map',
                    url: ComponentIds.Map
                }
            ];
        }
    }

    constructor() {
        super();
        // this.log('loggedInOnStart', this.loggedInOnStart, this.$authService.userProfile);
        // this.currentlyLoggedin = Vue.prototype.$authService.isLoggedIn();
        this.$setAppComponent(this);
        this.userProfile = this.$authService.userProfile || null;
        this.appVersion = EInfo.getVersionNameSync() + '.' + EInfo.getBuildNumberSync();
    }
    // onPushMessage(message: Message) {
    //     console.log('Push message received ', message);
    //     observable.notify({ eventName: 'pushMessage', object: observable, message });
    // }
    // onPushToken(token: string) {
    //     console.log('onPushToken', token);
    //     this.$authService.registerPushToken(token).catch(this.showError);
    // }
    async registerForPushNotifs() {
        // added this here so we can do some wiring
        // try {
        //     const result = await registerForPushNotifications({
        //         onPushTokenReceivedCallback: this.onPushToken.bind(this),
        //         onMessageReceivedCallback: this.onPushMessage.bind(this),
        //         // Whether you want this plugin to automatically display the notifications or just notify the callback. Currently used on iOS only. Default true.
        //         showNotifications: true,
        //         // Whether you want this plugin to always handle the notifications when the app is in foreground. Currently used on iOS only. Default false.
        //         showNotificationsWhenInForeground: true
        //     });
        //     console.log('Registered for push', result);
        //     if (global.isAndroid) {
        //         if (android.os.Build.VERSION.SDK_INT >= 26) {
        //             const color = android.graphics.Color.parseColor(colorPrimary);
        //             const context = androidApp.context;
        //             // API level 26 ("Android O") supports notification channels.
        //             const service = context.getSystemService(
        //                 android.content.Context.NOTIFICATION_SERVICE
        //             ) as android.app.NotificationManager;
        //             // create channel
        //             let channel = new android.app.NotificationChannel(
        //                 context.getString(ad.resources.getStringId('payment_channel_id')),
        //                 $t('payment_channel_name'),
        //                 android.app.NotificationManager.IMPORTANCE_HIGH
        //             );
        //             // channel.setDescription($t('payment_channel_description'));
        //             channel.setLightColor(color);
        //             service.createNotificationChannel(channel);
        //             channel = new android.app.NotificationChannel(
        //                 context.getString(ad.resources.getStringId('newpro_channel_id')),
        //                 $t('newpro_channel_name'),
        //                 android.app.NotificationManager.IMPORTANCE_DEFAULT
        //             );
        //             // channel.setDescription($t('newpro_channel_description'));
        //             channel.setLightColor(color);
        //             service.createNotificationChannel(channel);
        //             return true;
        //         } else {
        //             return false;
        //         }
        //     }
        // } catch (err) {
        //     if (err.toString().endsWith('MISSING_INSTANCEID_SERVICE')) {
        //         err = $tc('no_google_play_services');
        //     }
        //     this.showError(err);
        // }
    }

    onLoaded() {
        // GC();
    }
    destroyed() {
        this.innerFrame.off(Page.navigatingToEvent, this.onPageNavigation, this);
        super.destroyed();
        applicationOff(suspendEvent, this.onAppPause, this);
        applicationOff(resumeEvent, this.onAppResume, this);

        const authService = this.$authService;
        authService.off(NetworkConnectionStateEvent, this.onNetworkStateChange, this);
        authService.off(LoggedinEvent, this.onLoggedIn, this);
        authService.off(LoggedoutEvent, this.onLoggedOut, this);

        if (global.isAndroid && gVars.internalApp) {
            androidApp.unregisterBroadcastReceiver('com.lokavaluto.lokavaluto.SMS_RECEIVED');
            if (this.mMessageReceiver) {
                androidx.localbroadcastmanager.content.LocalBroadcastManager.getInstance(androidApp.context).unregisterReceiver(this.mMessageReceiver);
                this.mMessageReceiver = null;
            }
        }
    }
    onNetworkStateChange(e: NetworkConnectionStateEventData) {
        this.networkConnected = e.data.connected;
    }
    mounted(): void {
        super.mounted();
        applicationOn(resumeEvent, this.onAppResume, this);
        applicationOn(suspendEvent, this.onAppPause, this);
        const authService = Vue.prototype.$authService;
        authService.on(LoggedinEvent, this.onLoggedIn, this);
        authService.on(LoggedoutEvent, this.onLoggedOut, this);
        authService.on(NetworkConnectionStateEvent, this.onNetworkStateChange, this);

        this.innerFrame.on(Page.navigatingToEvent, this.onPageNavigation, this);

        // this.networkConnected = this.$authService.connected;
        if (global.isAndroid && gVars.internalApp) {
            perms
                .request('receiveSms')
                .then(() => {
                    androidApp.registerBroadcastReceiver('com.lokavaluto.lokavaluto.SMS_RECEIVED', (context: android.content.Context, intent: android.content.Intent) => {
                        const msg = intent.getStringExtra('message');
                        const sender = intent.getStringExtra('sender');
                        showSnack({
                            message: this.$t('sms_received', msg, sender)
                        });
                        new Vibrate().vibrate(1000);
                    });
                })
                .catch(this.showError);
        }
        // this.page.actionBarHidden = true;
        setDrawerInstance(this.drawer);

        // if (global.isIOS && app.ios.window.safeAreaInsets) {
        //     const bottomSafeArea: number = app.ios.window.safeAreaInsets.bottom;
        //     if (bottomSafeArea > 0) {
        //         app.addCss(`
        //           Button.button-bottom-nav { padding-bottom: ${bottomSafeArea} !important }
        //       `);
        //     }
        // }
        // this.activatedUrl = '/pairing';

        // this.router.events.subscribe((event: NavigationEnd) => {
        //     if (event instanceof NavigationEnd) {
        //         this.activatedUrl = event.urlAfterRedirects;
        //     }
        // });
    }
    appPaused = true;
    onLoggedIn(e?) {
        this.currentlyLoggedIn = true;
        console.log('we loggedin', this.currentlyLoggedIn);
        this.userProfile = this.$authService.userProfile;
        this.$crashReportService.setExtra('profile', JSON.stringify(this.userProfile));
        // if (e) {
        //     // means received as event
        //     this.navigateToUrl(ComponentIds.Situation, { clearHistory: true });
        // }
    }
    onLoggedOut() {
        if (WITH_PUSH_NOTIFICATIONS) {
            this.$authService.unregisterPushToken();
        }
        console.log('we logged out');
        this.$crashReportService.setExtra('profile', null);
        this.currentlyLoggedIn = false;
        this.$securityService.clear();
        this.navigateToUrl(ComponentIds.Map, { clearHistory: true });
        this.goToLogin();
    }
    firstResume = true;
    onAppResume(args: ApplicationEventData) {
        console.log('onAppResume', this.appPaused);
        if (!this.appPaused) {
            return;
        }
        this.appPaused = false;
        // if (global.isAndroid) {
        //     androidApp.foregroundActivity.paused = false;
        // }
        if (this.$securityService.autoLockEnabled) {
            this.$securityService.validateSecurity(this, { closeOnBack: true });
        }
        if (this.firstResume) {
            handleOpenURL(this.onAppUrl);
            if (this.loggedInOnStart) {
                this.onLoggedIn();
            }
        }
    }
    onAppPause(args: ApplicationEventData) {
        console.log('onAppPause', this.appPaused);

        if (this.appPaused) {
            return;
        }
        this.appPaused = true;
        if (global.isAndroid) {
            const intent = androidApp.foregroundActivity.getIntent();
            console.log('android app paused', intent && intent.getData() && intent.getData().toString());
            // androidApp.foregroundActivity.paused = true;
        }
    }

    // onBottomNavigationTabSelected(e) {
    //     console.log("onTabSelected", e.newIndex, this.selectedTabIndex)
    //     this.selectedTabIndex = e.newIndex;
    // }
    // tabviewLoaded(args: EventData) {
    //     var tabview = <any>args.object
    //     if (global.isAndroid) {
    //         var tabViewgrid = tabview._grid
    //         tabViewgrid.removeViewAt(0)
    //     } else if (global.isIOS) {
    //         tabview._ios.tabBar.hidden = true
    //     }
    // }
    // getCurrenFrame() {
    //     const tabView = this.getTabView();
    //     return tabView.items[tabView.selectedIndex].getViewById('frame');
    // }
    onNavigatingTo() {
        // this.$navigateTo(Login, {
        //         animated: false
        //     })
        // setTimeout(() =>
        //     this.$navigateBack(), 5000)
    }
    onPageNavigation(event) {
        if (!event.entry.resolvedPage) {
            return;
        }
        // this.log('onPageNavigation', event.entry.resolvedPage, event.entry.resolvedPage[navigateUrlProperty]);
        this.closeDrawer();
        this.setActivatedUrl(event.entry.resolvedPage[navigateUrlProperty]);
    }

    isComponentSelected(url: string) {
        // this.log('isComponentSelected', url, this.activatedUrl);
        return this.activatedUrl === url;
    }

    openDrawer() {
        this.drawer.open();
    }
    closeDrawer() {
        this.drawer && this.drawer.close();
    }
    onCloseDrawerTap() {
        this.closeDrawer();
    }
    onMenuIcon() {
        const canGoBack = this.canGoBack();
        // const canGoBack = this.innerFrame && this.innerFrame.canGoBack();

        if (canGoBack) {
            return this.navigateBack();
        } else {
            this.$emit('tapMenuIcon');
            // const drawer = getDrawerInstance();
            // if (drawer) {
            if (this.drawer.isSideOpened()) {
                this.drawer.close();
            } else {
                this.drawer.open();
            }
            // }
        }
    }
    canGoBack() {
        return this.innerFrame && this.innerFrame.canGoBack();
    }

    isActiveUrl(id) {
        // this.log('isActiveUrl', id, this.activatedUrl);
        return this.activatedUrl === id;
    }

    handleSetActivatedUrl(id) {
        this.$nextTick(() => {
            this.$refs.menu &&
                this.$refs.menu.nativeView.eachChildView((c: GridLayout) => {
                    c.notify({ eventName: 'activeChange', object: c });
                    c.eachChildView((c2) => {
                        if (c2.hasOwnProperty('active')) {
                            c2.notify({ eventName: 'activeChange', object: c });
                            return true;
                        }
                    });
                    return true;
                });
        });
    }
    // @log
    setActivatedUrl(id) {
        if (!id) {
            return;
        }
        this.activatedUrl = id;
        // this.log('setActivatedUrl', id);
        this.handleSetActivatedUrl(id);
    }
    async navigateBack(backEntry?) {
        this.innerFrame && this.innerFrame.goBack(backEntry);
    }

    async navigateBackIfUrl(url) {
        if (this.isActiveUrl(url)) {
            return this.navigateBack();
        }
    }
    findNavigationUrlIndex(url) {
        return this.innerFrame.backStack.findIndex((b) => b.resolvedPage[navigateUrlProperty] === url);
    }
    navigateBackToUrl(url) {
        const index = this.findNavigationUrlIndex(url);
        // console.log('navigateBackToUrl', url, index);
        if (index === -1) {
            // console.log(url, 'not in backstack');
            return Promise.reject();
        }
        return this.navigateBack(this.innerFrame.backStack[index]);
    }
    async navigateBackToRoot() {
        const stack = this.innerFrame.backStack;
        if (stack.length > 0) {
            this.innerFrame && this.innerFrame.goBack(stack[0]);
        }
    }
    onNavItemTap(url: string, comp?: any): void {
        // this.log('onNavItemTap', url);
        this.navigateToUrl(url as any);
        // });
    }
    onTap(command: string) {
        switch (command) {
            case 'sendFeedback':
                compose({
                    subject: `[${EInfo.getAppNameSync()}(${this.appVersion})] Feedback`,
                    to: ['martin@akylas.fr'],
                    attachments: [
                        {
                            fileName: 'report.json',
                            path: `base64://${base64Encode(
                                JSON.stringify(
                                    {
                                        device: {
                                            model: Device.model,
                                            deviceType: Device.deviceType,
                                            language: Device.language,
                                            manufacturer: Device.manufacturer,
                                            os: Device.os,
                                            osVersion: Device.osVersion,
                                            region: Device.region,
                                            sdkVersion: Device.sdkVersion,
                                            uuid: Device.uuid
                                        },
                                        screen: {
                                            widthDIPs: screenWidthDips,
                                            heightDIPs: screenHeightDips,
                                            widthPixels: Screen.mainScreen.widthPixels,
                                            heightPixels: Screen.mainScreen.heightPixels,
                                            scale: Screen.mainScreen.scale
                                        }
                                    },
                                    null,
                                    4
                                )
                            )}`,
                            mimeType: 'application/json'
                        }
                    ]
                }).catch(this.showError);
                break;
            case 'sendBugReport':
                login({
                    title: this.$tc('send_bug_report'),
                    message: this.$tc('send_bug_report_desc'),
                    okButtonText: this.$t('send'),
                    cancelButtonText: this.$t('cancel'),
                    autoFocus: true,
                    usernameTextFieldProperties: {
                        marginLeft: 10,
                        marginRight: 10,
                        autocapitalizationType: 'none',
                        keyboardType: 'email',
                        autocorrect: false,
                        error: this.$tc('email_required'),
                        hint: this.$tc('email')
                    },
                    passwordTextFieldProperties: {
                        marginLeft: 10,
                        marginRight: 10,
                        error: this.$tc('please_describe_error'),
                        secure: false,
                        hint: this.$tc('description')
                    },
                    beforeShow: (options, usernameTextField: TextField, passwordTextField: TextField) => {
                        usernameTextField.on('textChange', (e: any) => {
                            const text = e.value;
                            if (!text) {
                                usernameTextField.error = this.$tc('email_required');
                            } else if (!mailRegexp.test(text)) {
                                usernameTextField.error = this.$tc('non_valid_email');
                            } else {
                                usernameTextField.error = null;
                            }
                        });
                        passwordTextField.on('textChange', (e: any) => {
                            const text = e.value;
                            if (!text) {
                                passwordTextField.error = this.$tc('description_required');
                            } else {
                                passwordTextField.error = null;
                            }
                        });
                    }
                }).then((result) => {
                    if (result.result) {
                        if (!result.userName || !mailRegexp.test(result.userName)) {
                            this.showError(this.$tc('email_required'));
                            return;
                        }
                        if (!result.password || result.password.length === 0) {
                            this.showError(this.$tc('description_required'));
                            return;
                        }
                        this.$crashReportService.withScope((scope) => {
                            scope.setUser({ email: result.userName });
                            this.$crashReportService.captureMessage(result.password);
                            this.$alert(this.$t('bug_report_sent'));
                        });
                    }
                });
                break;
            case 'logout': {
                confirm({
                    // title: localize('stop_session'),
                    message: this.$tc('confirm_logout'),
                    okButtonText: this.$tc('logout'),
                    cancelButtonText: this.$tc('cancel')
                })
                    .then((r) => {
                        if (r) {
                            this.$authService.logout();
                        }
                    })
                    .catch(this.showError);
            }
        }
    }

    navigateTo(component: VueConstructor, options?: NavigationEntryVue, cb?: () => Page) {
        options = options || {};
        // options.transition = options.transition || {
        //     name: 'fade',
        //     duration: 200,
        //     curve: 'easeIn'
        // };
        (options as any).frame = options['frame'] || this.innerFrame.id;
        return super.navigateTo(component, options, cb);
    }
    async navigateToUrl(url: ComponentIds, options?: NavigationEntryVue, cb?: () => Page): Promise<any> {
        this.closeDrawer();
        if (this.isActiveUrl(url) || !this.routes[url]) {
            return Promise.reject();
        }
        // options = options || {};
        // options.props = options.props || {};
        // options.props[navigateUrlProperty] = url;

        console.log('navigateToUrl', url);
        const index = this.findNavigationUrlIndex(url);
        if (index === -1) {
            let component = this.routes[url].component;
            if (typeof component === 'function') {
                component = await (component as any)();
            }
            return this.navigateTo(component as NativeScriptVueConstructor, options);
        } else {
            return this.navigateBackToUrl(url);
        }
    }
    goBackToLogin() {
        if (this.loadingIndicator) {
            this.loadingIndicator.hide();
        }
        this.navigateToUrl(ComponentIds.Login, {
            // props: { autoConnect: false },
            clearHistory: true
        });
    }

    async goToLogin(options: any = {}, modal = true) {
        if (modal) {
            const component = (await import('~/common/components/Login')).default;
            return this.$showModal(component, { fullscreen: true, props: { modal: true, ...options } });
        } else {
            return this.navigateToUrl(ComponentIds.Login, { clearHistory: true });
        }
    }
    async showOverlayComponent(data) {
        if (global.isAndroid) {
            const activity = this.nativeView._context;
            if (!android.provider.Settings.canDrawOverlays(activity)) {
                await this.requestPermission(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
            }
            if (!android.provider.Settings.canDrawOverlays(activity)) {
                throw new Error('missing_overlay_permission');
            }
            const nativeApp = getNativeApplication();
            const mWindowManager = nativeApp.getSystemService(android.content.Context.WINDOW_SERVICE) as android.view.WindowManager;

            const close = function () {
                mWindowManager.removeView(frame);
                navEntryInstance.$destroy();
            };
            const navEntryInstance = new Vue({
                name: 'FloatingEntry',
                methods: {
                    close
                },
                render: (h) =>
                    h(Floating, {
                        props: {
                            qrCodeData: data
                        }
                        // key: serializeModalOptions(options)
                    })
            });
            const rootView = (navEntryInstance.$mount().$el as any).nativeView as View;
            rootView.cssClasses.add(CSSUtils.MODAL_ROOT_VIEW_CSS_CLASS);
            const modalRootViewCssClasses = CSSUtils.getSystemCssClasses();
            modalRootViewCssClasses.forEach((c) => rootView.cssClasses.add(c));
            rootView._setupAsRootView(activity);
            rootView._isAddedToNativeVisualTree = true;
            rootView.callLoaded();
            const frame = new android.widget.RelativeLayout(androidApp.context);
            frame.addView(rootView.nativeViewProtected);
            const params = new android.view.WindowManager.LayoutParams(
                android.view.WindowManager.LayoutParams.WRAP_CONTENT,
                android.view.WindowManager.LayoutParams.WRAP_CONTENT,
                android.view.WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                0,
                android.graphics.PixelFormat.TRANSLUCENT
            );
            params.gravity = android.view.Gravity.CENTER_HORIZONTAL | android.view.Gravity.CENTER_VERTICAL;
            params.x = 0;
            params.y = 0;
            mWindowManager.addView(frame, params);
        }
    }

    requestPermission(permission) {
        if (global.isAndroid) {
            const activity = androidApp.foregroundActivity || androidApp.startActivity;
            return new Promise<void>((resolve, reject) => {
                if (android.provider.Settings.canDrawOverlays(activity)) {
                    return resolve();
                }
                const REQUEST_CODE = 123;
                const onActivityResultHandler = (data: AndroidActivityResultEventData) => {
                    if (data.requestCode === REQUEST_CODE) {
                        androidApp.off(AndroidApplication.activityResultEvent, onActivityResultHandler);
                        resolve();
                    }
                };
                androidApp.on(AndroidApplication.activityResultEvent, onActivityResultHandler);
                const intent = new android.content.Intent(permission);
                intent.setData(android.net.Uri.parse('package:' + activity.getPackageName()));
                activity.startActivityForResult(intent, REQUEST_CODE);
                // android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION/
            });
        }
    }

    isVisisble() {
        if (global.isAndroid) {
            const activity = androidApp.startActivity;
            return activity && activity.getWindow().getDecorView().getRootView().isShown();
        }
    }

    handleReceivedAppUrl(url: string) {
        const parsed = parseUrlScheme(url);
        if (!parsed) {
            return;
        }
        switch (parsed.command) {
            case 'transfer': {
                if (!this.$authService.isLoggedIn()) {
                    this.showError(this.$t('loggedin_needed'));
                    return;
                }
                const data = parsed.data;
                if (global.isAndroid) {
                    const visible = this.isVisisble();
                    console.log('android transfer data', data, visible);
                    if (!visible) {
                        const context = this.nativeView._context;

                        // setTimeout(()=>{
                        // const context = this.nativeView._context;
                        try {
                            const intent = new android.content.Intent(context, com.lokavaluto.lokavaluto.FloatingActivity.class);
                            intent.putExtra('data', JSON.stringify(data));
                            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);

                            console.log('starting FloatingActivity activity');
                            context.startActivity(intent);
                            context.overridePendingTransition(0, 0);
                            context.moveTaskToBack(true);
                            return;
                        } catch (e) {
                            console.log('error starting activity', e, e.stack);
                        }
                        // }},500);
                        return;
                    }
                }

                if (this.activatedUrl === ComponentIds.Transfer) {
                    observable.notify({ eventName: QRCodeDataEvent, object: observable, data });
                } else {
                    this.navigateTo(TransferWindow, {
                        props: { qrCodeData: data }
                    });
                }
            }
        }
    }
    onAppUrl(appURL: AppURL, args) {
        this.log('Got the following appURL', appURL, args);
        // if (appURL.path.startsWith(CUSTOM_URL_SCHEME)) {

        if (global.isAndroid) {
            const activity = androidApp.startActivity;
            const visible = activity && activity.getWindow().getDecorView().getRootView().isShown();
            if (!visible) {
                if (args && args.eventName === AndroidApplication.activityStartedEvent) {
                    //ignoring newIntent in background as we already received start activity event with intent
                    return;
                } else {
                }
            }
        }
        try {
            this.handleReceivedAppUrl(CUSTOM_URL_SCHEME + '://' + appURL.path);
        } catch (err) {
            console.log(err);
        }
        // } else {
        // this.showError(this.$t('unknown_url_command'));
        // }
    }

    askToScanQrCode() {
        this.$scanQRCode().catch(this.showError);
    }
}
