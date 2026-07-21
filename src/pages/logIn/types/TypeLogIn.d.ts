export interface FormProps {
  phone_number: string;
  country_code: CountryCode|string;
  fcm_token: FcmToken;
  app: AppType;
  otp?:string | null;

}

type CountryCode = "963";
type AppType = "CLIENT";
type FcmToken = "23r24t35t...";
