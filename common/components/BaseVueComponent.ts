import { ActivityIndicator } from '@nativescript-community/ui-material-activityindicator';
import { AlertDialog } from '@nativescript-community/ui-material-dialogs';
import { Frame, Label, Page, StackLayout, View } from '@nativescript/core';
import { Color } from '@nativescript/core/color';
import { Progress } from '@nativescript/core/ui';
import { openUrl } from '@nativescript/core/utils/utils';
import { bind } from 'helpful-decorators';
import { InAppBrowser } from 'nativescript-inappbrowser';
import Vue, { NativeScriptVue, NavigationEntryVue } from 'nativescript-vue';
import { VueConstructor } from 'vue';
import { Prop } from 'vue-property-decorator';
import { $t } from '../helpers/locale';
import { colorAccent, appFontFamily, colorPrimaryDark, colorPrimary } from '../variables';

function timeout(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface BaseVueComponentRefs {
    [key: string]: any;
    page: NativeScriptVue<Page>;
}

export default class BaseVueComponent extends Vue {
    protected loadingIndicator: AlertDialog & { label?: Label; indicator?: ActivityIndicator; progress?: Progress };
    $refs: BaseVueComponentRefs;
    @Prop({ type: Color, default: () => colorPrimary })
    public themeColor;
    @Prop({ type: Color, default: () => colorPrimaryDark })
    public colorPrimaryDark;
    @Prop({ type: Color, default: () => colorAccent })
    public colorAccent;
    public appFontFamily = appFontFamily;
    needsRoundedWatchesHandle = false;
    debug = false;
    getRef<T = View>(key: string) {
        if (this.$refs[key]) {
            return (this.$refs[key] as NativeScriptVue<T>).nativeView;
        }
    }
    noop() {}
    getLoadingIndicator() {
        if (!this.loadingIndicator) {
            const instance = new (require('./LoadingIndicator.vue').default)();
            instance.$mount();
            const view = instance.nativeView;
            // const stack = new GridLayout();
            // stack.padding = 10;
            // stack.style.rows = 'auto,auto';
            // const activityIndicator = new ActivityIndicator();
            // activityIndicator.className = 'activity-indicator';
            // activityIndicator.busy = true;
            // stack.addChild(activityIndicator);
            // const label = new Label();
            // label.paddingLeft = 15;
            // label.textWrap = true;
            // label.verticalAlignment = 'middle';
            // label.fontSize = 16;
            // stack.addChild(label);
            this.loadingIndicator = new AlertDialog({
                view,
                cancelable: false
            });
            this.loadingIndicator.indicator = view.getChildAt(0) as ActivityIndicator;
            this.loadingIndicator.label = view.getChildAt(1) as Label;
            this.loadingIndicator.progress = view.getChildAt(2) as Progress;
        }
        return this.loadingIndicator;
    }
    showLoadingStartTime: number = null;
    showLoading(msg: string) {
        const loadingIndicator = this.getLoadingIndicator();
        // this.log('showLoading', msg, !!this.loadingIndicator);
        loadingIndicator.label.text = $t(msg) + '...';
        this.showLoadingStartTime = Date.now();
        loadingIndicator.show();
    }
    hideLoading() {
        const delta = this.showLoadingStartTime ? Date.now() - this.showLoadingStartTime : -1;
        if (delta >= 0 && delta < 1000) {
            setTimeout(() => this.hideLoading(), 1000 - delta);
            return;
        }
        // this.log('hideLoading', !!this.loadingIndicator);
        if (this.loadingIndicator) {
            this.loadingIndicator.hide();
        }
    }
    mounted() {}
    destroyed() {
        // this.log('destroyed');
    }

    navigateTo(component: VueConstructor, options?: NavigationEntryVue, cb?: () => Page) {
        options = options || {};
        (options as any).frame = options['frame'] || Frame.topmost().id;
        return this.$navigateTo(component, options, cb);
    }
    @bind
    async showError(err: Error | string) {
        return this.showErrorInternal(err);
    }
    async showErrorInternal(err: Error | string) {
        const delta = this.showLoadingStartTime ? Date.now() - this.showLoadingStartTime : -1;
        if (delta >= 0 && delta < 1000) {
            await timeout(1000 - delta);
            return this.showErrorInternal(err);
        }
        this.hideLoading();
        return this.$crashReportService.showError(err);
    }

    log(...args) {
        console.log(`[${this.constructor.name}]`, ...args);
    }

    goBack() {
        this.$getAppComponent().goBack();
    }
    async openLink(url: string) {
        try {
            const available = await InAppBrowser.isAvailable();
            if (available) {
                const result = await InAppBrowser.open(url, {
                    // iOS Properties
                    dismissButtonStyle: 'close',
                    preferredBarTintColor: colorPrimary as any,
                    preferredControlTintColor: 'white',
                    readerMode: false,
                    animated: true,
                    enableBarCollapsing: false,
                    // Android Properties
                    showTitle: true,
                    toolbarColor: colorPrimary as any,
                    secondaryToolbarColor: 'white',
                    enableUrlBarHiding: true,
                    enableDefaultShare: true,
                    forceCloseOnRedirection: false
                });
            } else {
                openUrl(url);
            }
        } catch (error) {
            alert({
                title: 'Error',
                message: error.message,
                okButtonText: 'Ok'
            });
        }
    }
}
