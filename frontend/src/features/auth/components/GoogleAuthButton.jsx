import { useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { authApi } from "@/features/auth/api/authApi";
import { SocialButton, GoogleIcon } from "@/components/ui/SocialButtons";
import { toast } from "@/components/ui/Toast";
import GoogleRoleModal from "./GoogleRoleModal";
import OtpModal from "./OtpModal";

export default function GoogleAuthButton({ onSuccess, onError }) {
  const [loading, setLoading] = useState(false);
  const [googleToken, setGoogleToken] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [otpState, setOtpState] = useState(null);

  const finish = async (tokens) => {
    const user = await fetch(`${import.meta.env.VITE_API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    }).then((r) => r.json());
    onSuccess(user, tokens.access_token, tokens.refresh_token);
  };

  const handleResponse = (res) => {
    if (res.requires_role_selection) {
      setUserInfo({ email: res.email, full_name: res.full_name, profile_photo_url: res.profile_photo_url });
      setLoading(false);
      return;
    }
    if (res.requires_verification) {
      setOtpState({ email: res.email, channel: res.channel, destination: res.destination });
      setLoading(false);
      return;
    }
    if (res.is_new_user === false) {
      toast("You already have an account with this email — signing you in.", "warning");
    }
    finish(res);
  };

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        setGoogleToken(tokenResponse.access_token);
        const res = await authApi.googleAuth(tokenResponse.access_token);
        handleResponse(res);
      } catch (err) {
        onError(err.response?.data?.detail || "Google sign-in failed.");
        setLoading(false);
      }
    },
    onError: () => onError("Google sign-in was cancelled or failed."),
  });

  const handleRoleConfirm = async (role, termsAccepted) => {
    setLoading(true);
    try {
      const res = await authApi.googleAuth(googleToken, role, termsAccepted);
      setUserInfo(null);
      handleResponse(res);
    } catch (err) {
      onError(err.response?.data?.detail || "Google sign-up failed.");
      setLoading(false);
    }
  };

  const reset = () => {
    setOtpState(null);
    setUserInfo(null);
    setGoogleToken(null);
  };

  return (
    <>
      {userInfo && (
        <GoogleRoleModal
          userInfo={userInfo}
          onConfirm={handleRoleConfirm}
          onClose={reset}
          loading={loading}
        />
      )}
      {otpState && (
        <OtpModal
          email={otpState.email}
          channel={otpState.channel}
          destination={otpState.destination}
          onSuccess={(tokens) => { setOtpState(null); finish(tokens); }}
          onClose={reset}
        />
      )}
      <SocialButton
        icon={<GoogleIcon />}
        label="Google"
        onClick={() => googleLogin()}
        loading={loading}
      />
    </>
  );
}
