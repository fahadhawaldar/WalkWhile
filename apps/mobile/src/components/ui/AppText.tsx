import { Text, TextProps } from 'react-native';
import { type, typeColor, TypeVariant, useColors } from '../../theme';

export function AppText({
  variant = 'body',
  color,
  style,
  ...props
}: TextProps & { variant?: TypeVariant; color?: string }) {
  const c = useColors();
  return <Text style={[type[variant], { color: color ?? (c[typeColor[variant]] as string) }, style]} {...props} />;
}
