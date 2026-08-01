alter table app_settings add constraint app_settings_passcode_not_blank check (length(btrim(passcode)) > 0);
