import { Stack } from 'expo-router';
import { LogBox } from 'react-native';

LogBox.ignoreLogs([
  /Cannot record touch end without a touch start/,
  /Ended a touch event which was not counted/,
  /react-native-skia.*deprecated/,
  /Response\.blob/
]);

export default function Layout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
