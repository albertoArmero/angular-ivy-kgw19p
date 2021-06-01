// tslint:disable:missing-jsdoc

import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { ScanditSdkModule } from "scandit-sdk-angular";
import { AppComponent } from "./app.component";

// tslint:disable-next-line:max-line-length
const licenseKey: string = "AUBvsDT/FLMkKmSYZymM0NspayuxCCHcmFlyiSBmBUczXUGX60TmeJgrUny3cL9nWmjR4GdxVefmScyRZgX/rsYhl4jUbbZQvkAo3xtzGjkZGkYyCGWQKvR0VWisSnfjTGzackAjMIGSH5KeeyIbnY0rxgKu2Bjxscw8fxD1UCgF+hC+gDFDki0RTeUPNBk31pvx5m2ARopaeNVR29vdWfXdT9Uoxk2cYeoCCIN3HgjWT4Yuv8XQr05L/po4buUZHiy7MgjRx+L/lFINTlQo0UQYLZ7bXJtgVoAO6ZFnIhYwOWqGgNlk7wjCIXwrCOfJkpkJyPj9Hcvmz+bLxHieS8hKy2bm+49AYcIsFrE55Zm4JFUm/IbPSIdRCdN2zh9kV636/7MSAgyh2o9G6Nl4ZEFpnw6Bu6nE5A4QlJKOWtCMptpdXTz0IMm9wKQF5ebIYGplehU+4cSyUQzYnV7oDIsLid4IGafUk/RX6T2rV4FodUqhhCMU3W1Oy5q/0gPl4kGT7wGKtcZFt80d00n4+0TQrdyCe+ak9A60NtW6TW6+2+JKVPFrDe6cRAmjOc96tJLL4sl0UCja6UI7mgNJmm6JgffU/VA/z7Mbi1Cb7V4nbkIPP6SyN1bHY+x6TB6TQGRqdfxrRb6DZXv3gCiw0GJCUD1imyfhmrmClIWT8om7PUQmqiFt2Q31OuNrnuiqVApuzpsX7tHV8t5w7FRj2FlBN4I9O77zmwpt6p3E+VsxzyB5SH5j0bzv2iiBBY8qRxZK2aqe8MrCrxmmuEGf0mukev+59rZIOo229cCgn0aaFq4qEJuCYV4LcymbwhGO3os=";
const engineLocation: string = "https://cdn.jsdelivr.net/npm/scandit-sdk@5.x/build/"; // could also be e.g. "build"

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, ScanditSdkModule.forRoot(licenseKey, {engineLocation})],
  bootstrap: [AppComponent],
})
// tslint:disable-next-line:no-unnecessary-class
export class AppModule {}
