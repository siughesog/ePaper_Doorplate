// src/navigation.ts
import { NavigateFunction } from 'react-router-dom';

export const goToTemplate = (navigate: NavigateFunction) => {
  return navigate(`/template`);
};

export const goToUserProfile = (navigate: NavigateFunction, userId: string) => {
  if (!userId) return;
  navigate(`/profile/${userId}`);
};
