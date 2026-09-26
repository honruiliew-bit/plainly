"use client";

import { createContext, useContext } from "react";
import type { Profile } from "./types";

export type ProfileCtx = {
  profile: Profile | null;
  loaded: boolean;
  setProfile: (p: Profile) => void;
  openProfile: () => void;
};

export const ProfileContext = createContext<ProfileCtx>({
  profile: null,
  loaded: false,
  setProfile: () => {},
  openProfile: () => {},
});

export const useProfile = () => useContext(ProfileContext);
